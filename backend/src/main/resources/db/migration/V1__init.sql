-- Users and refresh tokens -------------------------------------------------------------------

CREATE TABLE users (
    id            UUID PRIMARY KEY,
    email         TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

-- Refresh tokens rotate on every use. All tokens from one sign-in share a family_id, so reusing an
-- already-rotated token (a sign it was stolen) revokes the whole family.
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id   UUID        NOT NULL,
    token_hash  TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ,
    replaced_by UUID
);
CREATE INDEX refresh_tokens_family ON refresh_tokens (family_id);

-- Synced data ---------------------------------------------------------------------------------
-- Ids are generated on the phone. Every row keeps:
--   client_updated_at  the editing device's clock, used for last-write-wins
--   deleted            tombstone, so deletions reach the user's other devices
--   version            server-assigned, increasing; devices ask for "everything after version N"
-- There are no foreign keys between synced tables: devices may upload rows in any order.

CREATE SEQUENCE sync_version_seq;

CREATE TABLE accounts (
    id                UUID PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              TEXT        NOT NULL,
    type              TEXT        NOT NULL CHECK (type IN ('cash', 'bank', 'ewallet', 'card')),
    opening_balance   BIGINT      NOT NULL,
    archived          BOOLEAN     NOT NULL,
    client_updated_at BIGINT      NOT NULL,
    deleted           BOOLEAN     NOT NULL,
    version           BIGINT      NOT NULL,
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id                UUID PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              TEXT        NOT NULL,
    kind              TEXT        NOT NULL CHECK (kind IN ('expense', 'income')),
    color             TEXT        NOT NULL,
    icon              TEXT        NOT NULL,
    client_updated_at BIGINT      NOT NULL,
    deleted           BOOLEAN     NOT NULL,
    version           BIGINT      NOT NULL,
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
    id                UUID PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    account_id        UUID        NOT NULL,
    category_id       UUID        NOT NULL,
    kind              TEXT        NOT NULL CHECK (kind IN ('expense', 'income')),
    amount            BIGINT      NOT NULL CHECK (amount >= 0),
    note              TEXT        NOT NULL,
    occurred_on       DATE        NOT NULL,
    recurring_id      UUID,
    client_updated_at BIGINT      NOT NULL,
    deleted           BOOLEAN     NOT NULL,
    version           BIGINT      NOT NULL,
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE budgets (
    id                UUID PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id       UUID        NOT NULL,
    amount            BIGINT      NOT NULL CHECK (amount >= 0),
    client_updated_at BIGINT      NOT NULL,
    deleted           BOOLEAN     NOT NULL,
    version           BIGINT      NOT NULL,
    server_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recurring (
    id                 UUID PRIMARY KEY,
    user_id            UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name               TEXT        NOT NULL,
    account_id         UUID        NOT NULL,
    category_id        UUID        NOT NULL,
    kind               TEXT        NOT NULL CHECK (kind IN ('expense', 'income')),
    amount             BIGINT      NOT NULL CHECK (amount >= 0),
    frequency          TEXT        NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    start_date         DATE        NOT NULL,
    remind_days_before INT         NOT NULL,
    active             BOOLEAN     NOT NULL,
    client_updated_at  BIGINT      NOT NULL,
    deleted            BOOLEAN     NOT NULL,
    version            BIGINT      NOT NULL,
    server_updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX accounts_user_version     ON accounts (user_id, version);
CREATE INDEX categories_user_version   ON categories (user_id, version);
CREATE INDEX transactions_user_version ON transactions (user_id, version);
CREATE INDEX budgets_user_version      ON budgets (user_id, version);
CREATE INDEX recurring_user_version    ON recurring (user_id, version);
