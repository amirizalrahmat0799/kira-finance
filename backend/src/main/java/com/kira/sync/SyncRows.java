package com.kira.sync;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Wire format of synced rows. Field names match the phone's SQLite model; money is integer sen;
 * {@code updatedAt} is the editing device's clock in epoch millis and decides conflicts.
 */
public final class SyncRows {

    private SyncRows() {
    }

    /** Fields every synced row has. */
    public interface Row {
        UUID id();

        long updatedAt();

        boolean deleted();
    }

    public record AccountRow(
        @NotNull UUID id,
        @NotBlank @Size(max = 60) String name,
        @NotNull @Pattern(regexp = "cash|bank|ewallet|card") String type,
        long openingBalance,
        boolean archived,
        @PositiveOrZero long updatedAt,
        boolean deleted) implements Row {
    }

    public record CategoryRow(
        @NotNull UUID id,
        @NotBlank @Size(max = 40) String name,
        @NotNull @Pattern(regexp = "expense|income") String kind,
        @NotNull @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color,
        @NotBlank @Size(max = 16) String icon,
        @PositiveOrZero long updatedAt,
        boolean deleted) implements Row {
    }

    public record TransactionRow(
        @NotNull UUID id,
        @NotNull UUID accountId,
        @NotNull UUID categoryId,
        @NotNull @Pattern(regexp = "expense|income") String kind,
        @PositiveOrZero long amount,
        @Size(max = 200) String note,
        @NotNull LocalDate occurredOn,
        UUID recurringId,
        @PositiveOrZero long updatedAt,
        boolean deleted) implements Row {

        public TransactionRow {
            note = note == null ? "" : note;
        }
    }

    public record BudgetRow(
        @NotNull UUID id,
        @NotNull UUID categoryId,
        @PositiveOrZero long amount,
        @PositiveOrZero long updatedAt,
        boolean deleted) implements Row {
    }

    public record RecurringRow(
        @NotNull UUID id,
        @NotBlank @Size(max = 60) String name,
        @NotNull UUID accountId,
        @NotNull UUID categoryId,
        @NotNull @Pattern(regexp = "expense|income") String kind,
        @PositiveOrZero long amount,
        @NotNull @Pattern(regexp = "weekly|monthly|yearly") String frequency,
        @NotNull LocalDate startDate,
        @Min(0) @Max(30) int remindDaysBefore,
        boolean active,
        @PositiveOrZero long updatedAt,
        boolean deleted) implements Row {
    }

    /** One list per table; a missing list means "no changes". */
    public record Changes(
        List<@Valid AccountRow> accounts,
        List<@Valid CategoryRow> categories,
        List<@Valid TransactionRow> transactions,
        List<@Valid BudgetRow> budgets,
        List<@Valid RecurringRow> recurring) {

        public Changes {
            accounts = accounts == null ? List.of() : accounts;
            categories = categories == null ? List.of() : categories;
            transactions = transactions == null ? List.of() : transactions;
            budgets = budgets == null ? List.of() : budgets;
            recurring = recurring == null ? List.of() : recurring;
        }

        public static Changes empty() {
            return new Changes(null, null, null, null, null);
        }

        public int size() {
            return accounts.size() + categories.size() + transactions.size() + budgets.size() + recurring.size();
        }
    }

    public record SyncRequest(@PositiveOrZero long cursor, @Valid Changes changes) {

        public SyncRequest {
            changes = changes == null ? Changes.empty() : changes;
        }
    }

    public record SyncResponse(long cursor, Changes changes) {
    }
}
