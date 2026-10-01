package com.kira.sync;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.kira.config.KiraProperties;
import com.kira.sync.SyncRows.Changes;
import com.kira.sync.SyncRows.Row;
import com.kira.sync.SyncRows.SyncRequest;
import com.kira.sync.SyncRows.SyncResponse;
import com.kira.web.ApiException;

/**
 * Push-then-pull sync in a single transaction.
 *
 * <p>Versions come from one global sequence, so "everything after version N" is a complete delta only if no
 * transaction with a smaller version commits after a reader has moved past it. All of a user's rows are written
 * by that user's own syncs, so taking a per-user advisory lock serialises exactly the writes that matter.
 */
@Service
public class SyncService {

    private final JdbcClient jdbc;
    private final int maxRowsPerTable;

    public SyncService(JdbcClient jdbc, KiraProperties props) {
        this.jdbc = jdbc;
        this.maxRowsPerTable = props.sync() == null || props.sync().maxRowsPerTable() <= 0 ? 5000 : props.sync().maxRowsPerTable();
    }

    @Transactional
    public SyncResponse sync(UUID userId, SyncRequest request) {
        Changes in = request.changes();
        for (List<?> list : List.of(in.accounts(), in.categories(), in.transactions(), in.budgets(), in.recurring())) {
            if (list.size() > maxRowsPerTable) {
                throw new ApiException(HttpStatus.valueOf(413), "Too many changes in one sync (max " + maxRowsPerTable + " per table)");
            }
        }

        lockUser(userId);

        push(userId, SyncTables.ACCOUNTS, in.accounts());
        push(userId, SyncTables.CATEGORIES, in.categories());
        push(userId, SyncTables.TRANSACTIONS, in.transactions());
        push(userId, SyncTables.BUDGETS, in.budgets());
        push(userId, SyncTables.RECURRING, in.recurring());

        long after = request.cursor();
        long upTo = Math.max(after, latestVersion(userId));
        Changes out = new Changes(
            pull(userId, SyncTables.ACCOUNTS, after, upTo),
            pull(userId, SyncTables.CATEGORIES, after, upTo),
            pull(userId, SyncTables.TRANSACTIONS, after, upTo),
            pull(userId, SyncTables.BUDGETS, after, upTo),
            pull(userId, SyncTables.RECURRING, after, upTo));
        return new SyncResponse(upTo, out);
    }

    private void lockUser(UUID userId) {
        long key = userId.getMostSignificantBits() ^ userId.getLeastSignificantBits();
        jdbc.sql("SELECT 1 FROM (SELECT pg_advisory_xact_lock(:key)) AS locked").param("key", key).query(Integer.class).single();
    }

    private <T extends Row> void push(UUID userId, SyncTable<T> table, List<T> rows) {
        String sql = table.upsertSql();
        for (T row : rows) {
            jdbc.sql(sql).params(table.params(userId, row)).update();
        }
    }

    private <T extends Row> List<T> pull(UUID userId, SyncTable<T> table, long after, long upTo) {
        return jdbc.sql(table.pullSql())
            .param("user_id", userId)
            .param("after", after)
            .param("upto", upTo)
            .query(table.mapper())
            .list();
    }

    private long latestVersion(UUID userId) {
        String union = SyncTables.ALL.stream()
            .map(t -> "SELECT max(version) AS v FROM " + t.name() + " WHERE user_id = :user_id")
            .reduce((a, b) -> a + " UNION ALL " + b)
            .orElseThrow();
        Long v = jdbc.sql("SELECT coalesce(max(v), 0) FROM (" + union + ") versions")
            .param("user_id", userId)
            .query(Long.class)
            .single();
        return v == null ? 0 : v;
    }
}
