package com.kira.sync;

import static com.kira.sync.SyncTable.uuid;

import java.sql.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.kira.sync.SyncRows.AccountRow;
import com.kira.sync.SyncRows.BudgetRow;
import com.kira.sync.SyncRows.CategoryRow;
import com.kira.sync.SyncRows.RecurringRow;
import com.kira.sync.SyncRows.TransactionRow;

/** The five synced tables. Column names match V1__init.sql. */
public final class SyncTables {

    private SyncTables() {
    }

    public static final SyncTable<AccountRow> ACCOUNTS = new SyncTable<>(
        "accounts",
        List.of("name", "type", "opening_balance", "archived"),
        r -> Map.of("name", r.name(), "type", r.type(), "opening_balance", r.openingBalance(), "archived", r.archived()),
        (rs, i) -> new AccountRow(uuid(rs, "id"), rs.getString("name"), rs.getString("type"), rs.getLong("opening_balance"),
            rs.getBoolean("archived"), rs.getLong("client_updated_at"), rs.getBoolean("deleted")));

    public static final SyncTable<CategoryRow> CATEGORIES = new SyncTable<>(
        "categories",
        List.of("name", "kind", "color", "icon"),
        r -> Map.of("name", r.name(), "kind", r.kind(), "color", r.color(), "icon", r.icon()),
        (rs, i) -> new CategoryRow(uuid(rs, "id"), rs.getString("name"), rs.getString("kind"), rs.getString("color"),
            rs.getString("icon"), rs.getLong("client_updated_at"), rs.getBoolean("deleted")));

    public static final SyncTable<TransactionRow> TRANSACTIONS = new SyncTable<>(
        "transactions",
        List.of("account_id", "category_id", "kind", "amount", "note", "occurred_on", "recurring_id"),
        r -> {
            // Map.of() rejects nulls, and recurring_id is optional
            Map<String, Object> m = new HashMap<>();
            m.put("account_id", r.accountId());
            m.put("category_id", r.categoryId());
            m.put("kind", r.kind());
            m.put("amount", r.amount());
            m.put("note", r.note());
            m.put("occurred_on", Date.valueOf(r.occurredOn()));
            m.put("recurring_id", r.recurringId());
            return m;
        },
        (rs, i) -> new TransactionRow(uuid(rs, "id"), uuid(rs, "account_id"), uuid(rs, "category_id"), rs.getString("kind"),
            rs.getLong("amount"), rs.getString("note"), rs.getDate("occurred_on").toLocalDate(), uuid(rs, "recurring_id"),
            rs.getLong("client_updated_at"), rs.getBoolean("deleted")));

    public static final SyncTable<BudgetRow> BUDGETS = new SyncTable<>(
        "budgets",
        List.of("category_id", "amount"),
        r -> Map.of("category_id", r.categoryId(), "amount", r.amount()),
        (rs, i) -> new BudgetRow(uuid(rs, "id"), uuid(rs, "category_id"), rs.getLong("amount"), rs.getLong("client_updated_at"),
            rs.getBoolean("deleted")));

    public static final SyncTable<RecurringRow> RECURRING = new SyncTable<>(
        "recurring",
        List.of("name", "account_id", "category_id", "kind", "amount", "frequency", "start_date", "remind_days_before", "active"),
        r -> {
            Map<String, Object> m = new HashMap<>();
            m.put("name", r.name());
            m.put("account_id", r.accountId());
            m.put("category_id", r.categoryId());
            m.put("kind", r.kind());
            m.put("amount", r.amount());
            m.put("frequency", r.frequency());
            m.put("start_date", Date.valueOf(r.startDate()));
            m.put("remind_days_before", r.remindDaysBefore());
            m.put("active", r.active());
            return m;
        },
        (rs, i) -> new RecurringRow(uuid(rs, "id"), rs.getString("name"), uuid(rs, "account_id"), uuid(rs, "category_id"),
            rs.getString("kind"), rs.getLong("amount"), rs.getString("frequency"), rs.getDate("start_date").toLocalDate(),
            rs.getInt("remind_days_before"), rs.getBoolean("active"), rs.getLong("client_updated_at"), rs.getBoolean("deleted")));

    public static final List<SyncTable<?>> ALL = List.of(ACCOUNTS, CATEGORIES, TRANSACTIONS, BUDGETS, RECURRING);
}
