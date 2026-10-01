package com.kira.sync;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.RowMapper;

import com.kira.sync.SyncRows.Row;

/**
 * Describes one synced table once: its data columns, how to turn a row into SQL parameters and back.
 * The upsert and pull statements for all five tables are generated from these descriptions.
 */
public record SyncTable<T extends Row>(
    String name,
    List<String> columns,
    Function<T, Map<String, Object>> toColumns,
    RowMapper<T> mapper) {

    /**
     * Last write wins, decided by the client's clock: an incoming row only replaces the stored one when it was
     * edited later. The WHERE on user_id makes a row owned by someone else impossible to overwrite.
     * Every accepted write takes a new value from the shared version sequence.
     */
    public String upsertSql() {
        String cols = String.join(", ", columns);
        String params = columns.stream().map(c -> ":" + c).collect(Collectors.joining(", "));
        String updates = columns.stream().map(c -> c + " = EXCLUDED." + c).collect(Collectors.joining(", "));
        return "INSERT INTO " + name + " (id, user_id, " + cols + ", client_updated_at, deleted, version) "
            + "VALUES (:id, :user_id, " + params + ", :client_updated_at, :deleted, nextval('sync_version_seq')) "
            + "ON CONFLICT (id) DO UPDATE SET " + updates + ", client_updated_at = EXCLUDED.client_updated_at, "
            + "deleted = EXCLUDED.deleted, version = EXCLUDED.version, server_updated_at = now() "
            + "WHERE " + name + ".user_id = EXCLUDED.user_id AND EXCLUDED.client_updated_at > " + name + ".client_updated_at";
    }

    public String pullSql() {
        return "SELECT id, " + String.join(", ", columns) + ", client_updated_at, deleted FROM " + name
            + " WHERE user_id = :user_id AND version > :after AND version <= :upto ORDER BY version";
    }

    public Map<String, Object> params(UUID userId, T row) {
        Map<String, Object> p = new LinkedHashMap<>(toColumns.apply(row));
        p.put("id", row.id());
        p.put("user_id", userId);
        p.put("client_updated_at", row.updatedAt());
        p.put("deleted", row.deleted());
        return p;
    }

    /** Small helpers for the row mappers. */
    static UUID uuid(ResultSet rs, String col) throws SQLException {
        return rs.getObject(col, UUID.class);
    }
}
