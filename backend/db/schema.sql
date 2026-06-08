-- ============================================================
-- Run this entire file in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. USERS table
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EXPENSES table
CREATE TABLE IF NOT EXISTS expenses (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         NUMERIC(12, 2) NOT NULL,
  category       TEXT NOT NULL DEFAULT 'other',
  description    TEXT,
  date           DATE NOT NULL,
  payment_method TEXT DEFAULT 'Cash',
  merchant       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id  ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date      ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category  ON expenses(category);

-- 3. BUDGETS table
CREATE TABLE IF NOT EXISTS budgets (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  amount     NUMERIC(12, 2) NOT NULL,
  period     TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- 4. GROUPS table
CREATE TABLE IF NOT EXISTS groups (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. GROUP_MEMBERS table
CREATE TABLE IF NOT EXISTS group_members (
  group_id   BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- 6. GROUP_EXPENSES table
CREATE TABLE IF NOT EXISTS group_expenses (
  id          BIGSERIAL PRIMARY KEY,
  group_id    BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 7. GROUP_EXPENSE_SPLITS table
CREATE TABLE IF NOT EXISTS group_expense_splits (
  id          BIGSERIAL PRIMARY KEY,
  expense_id  BIGINT NOT NULL REFERENCES group_expenses(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_owed NUMERIC(12, 2) NOT NULL
);

-- 8. SETTLEMENTS table
CREATE TABLE IF NOT EXISTS settlements (
  id          BIGSERIAL PRIMARY KEY,
  group_id    BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paid_to     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(12, 2) NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Disable RLS (we handle auth ourselves with JWT)
ALTER TABLE users                DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses             DISABLE ROW LEVEL SECURITY;
ALTER TABLE budgets              DISABLE ROW LEVEL SECURITY;
ALTER TABLE groups               DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_members        DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_expenses       DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_expense_splits DISABLE ROW LEVEL SECURITY;
ALTER TABLE settlements          DISABLE ROW LEVEL SECURITY;
