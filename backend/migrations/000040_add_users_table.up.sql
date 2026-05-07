CREATE TABLE IF NOT EXISTS users ( -- noqa: RF04
    id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- noqa: RF04
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users (id), -- noqa: RF04
    approved_at TIMESTAMPTZ,
    is_bootstrap BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email); -- noqa: RF04
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username); -- noqa: RF04
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status); -- noqa: RF04
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at); -- noqa: RF04
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at); -- noqa: RF04

COMMENT ON TABLE users IS -- noqa: RF04
'System users with authentication credentials and provisioning status.
Users request access (status=pending), an admin approves them (status=active),
and they can be deactivated (status=inactive). The is_bootstrap row is the
one-time seed admin that must be replaced by a real admin account before use.';

COMMENT ON COLUMN users.id IS 'Surrogate primary key (UUID v4).'; -- noqa: RF04
COMMENT ON COLUMN users.email IS 'Unique email address used for login and notifications.'; -- noqa: RF04
COMMENT ON COLUMN users.username IS 'Unique display username (alphanumeric + underscores).'; -- noqa: RF04
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash of the user password. Never stored in plain text.'; -- noqa: RF04
COMMENT ON COLUMN users.full_name IS 'Human-readable full name of the user.'; -- noqa: RF04
COMMENT ON COLUMN users.role IS 'Authorisation role: admin (full access) or user (read/restricted access).'; -- noqa: RF04
COMMENT ON COLUMN users.status IS -- noqa: RF04
'Provisioning lifecycle: pending (awaiting admin approval), active (can log in), inactive (deactivated).';
COMMENT ON COLUMN users.approved_by IS 'UUID of the admin user who approved this account. NULL while pending.'; -- noqa: RF04
COMMENT ON COLUMN users.approved_at IS 'Timestamp when the account was approved. NULL while pending.'; -- noqa: RF04
COMMENT ON COLUMN users.is_bootstrap IS -- noqa: RF04
'TRUE for the one-time seed admin account. Once a real admin account is created and verified,
the bootstrap account is deactivated (status=inactive) automatically.';
COMMENT ON COLUMN users.created_at IS 'Timestamp when the user record was created.'; -- noqa: RF04
COMMENT ON COLUMN users.updated_at IS 'Timestamp of the last update to the user record.'; -- noqa: RF04
COMMENT ON COLUMN users.deleted_at IS 'Soft-delete timestamp. NULL when the record is active.'; -- noqa: RF04

-- Seed the one-time bootstrap admin account.
-- Password is 'Admin1234!' (bcrypt cost 12). Must be changed on first use.
-- This hash corresponds to password: Admin1234!
INSERT INTO users ( -- noqa: RF04
    id,
    email,
    username,
    password_hash,
    full_name,
    role, -- noqa: RF04
    status,
    is_bootstrap
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@axiom.local',
    'admin',
    '$2a$12$udxIKaySfrKcROAK4/n8qeN8gB6A2KWMKbFc2ls4zYHwbMDgtmoVq',
    'Bootstrap Administrator',
    'admin',
    'active',
    TRUE
) ON CONFLICT (id) DO NOTHING;
