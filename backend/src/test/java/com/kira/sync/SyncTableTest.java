package com.kira.sync;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.kira.sync.SyncRows.TransactionRow;

class SyncTableTest {

    @Test
    void upsertOnlyReplacesNewerRowsOfTheSameUser() {
        String sql = SyncTables.BUDGETS.upsertSql();

        assertThat(sql).startsWith("INSERT INTO budgets (id, user_id, category_id, amount, client_updated_at, deleted, version)");
        assertThat(sql).contains("nextval('sync_version_seq')");
        assertThat(sql).contains("ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, amount = EXCLUDED.amount");
        assertThat(sql).endsWith("WHERE budgets.user_id = EXCLUDED.user_id AND EXCLUDED.client_updated_at > budgets.client_updated_at");
    }

    @Test
    void pullReadsAWindowOfVersionsForOneUser() {
        assertThat(SyncTables.ACCOUNTS.pullSql()).isEqualTo(
            "SELECT id, name, type, opening_balance, archived, client_updated_at, deleted FROM accounts"
                + " WHERE user_id = :user_id AND version > :after AND version <= :upto ORDER BY version");
    }

    @Test
    void paramsCoverEveryPlaceholderAndAllowAMissingRecurringId() {
        UUID user = UUID.randomUUID();
        TransactionRow row = new TransactionRow(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "expense", 1250,
            null, LocalDate.of(2026, 10, 2), null, 1_790_000_000_000L, false);

        var params = SyncTables.TRANSACTIONS.params(user, row);

        assertThat(params).containsKeys("id", "user_id", "client_updated_at", "deleted", "recurring_id");
        assertThat(params.get("recurring_id")).isNull();
        assertThat(params.get("note")).isEqualTo("");
        for (String column : SyncTables.TRANSACTIONS.columns()) {
            assertThat(params).containsKey(column);
        }
    }

    @Test
    void everyTableIsRegistered() {
        assertThat(SyncTables.ALL).extracting(SyncTable::name)
            .containsExactly("accounts", "categories", "transactions", "budgets", "recurring");
    }
}
