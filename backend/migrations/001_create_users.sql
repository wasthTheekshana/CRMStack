-- ============================================================
-- 001_create_users.sql
-- Users table — replaces Firestore 'users' collection
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    username    VARCHAR(100) NOT NULL UNIQUE,       -- lowercase, for case-insensitive login
    display_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,            -- bcrypt hash
    role        VARCHAR(20) NOT NULL DEFAULT 'sales'
                    CHECK (role IN ('admin', 'sales')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_role     ON users(role);
