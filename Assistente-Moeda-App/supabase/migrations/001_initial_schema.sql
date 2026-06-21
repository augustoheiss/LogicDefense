-- ============================================================================
-- Assistente Moeda — Supabase Schema Migration
-- ============================================================================
-- Run this SQL in the Supabase Dashboard → SQL Editor
-- Creates the core tables for the CoinAssistant data layer:
--   1. profiles  — User profiles with sync preferences and freemium tier
--   2. coin_tables — Financial tables (metadata + goals)
--   3. coin_rows  — Individual financial entries
-- ============================================================================

-- ── 1. Profiles ──────────────────────────────────────────────────────────────
-- Extended from Supabase Auth's built-in auth.users table.
-- Stores app-specific user preferences and freemium tier.

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  sync_enabled BOOLEAN DEFAULT TRUE,
  premium_tier TEXT DEFAULT 'free' CHECK (premium_tier IN ('free', 'premium')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ── 2. Coin Tables ──────────────────────────────────────────────────────────
-- Each table represents a financial workspace (e.g., "Uber", "Personal").
-- Goals are stored as JSONB to preserve the full TableGoals hierarchy.

CREATE TABLE IF NOT EXISTS coin_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  goals JSONB NOT NULL DEFAULT '{
    "dailyGoals": {},
    "weeklyGoals": {},
    "annualCosts": {}
  }',
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coin_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tables"
  ON coin_tables FOR ALL
  USING (auth.uid() = user_id);


-- ── 3. Coin Rows ─────────────────────────────────────────────────────────────
-- Individual financial entries within a table.
-- Maps 1:1 to the TableRow TypeScript interface.

CREATE TABLE IF NOT EXISTS coin_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID REFERENCES coin_tables(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  description TEXT,
  entry_type TEXT DEFAULT 'revenue' CHECK (
    entry_type IN ('revenue', 'deposit', 'waiver', 'expense', 'partner_in', 'partner_out')
  ),
  monthly_value DECIMAL(12,2),
  month_count INT,
  period_start DATE,
  period_end DATE,
  generated_by TEXT CHECK (generated_by IN ('predicted', 'cloned') OR generated_by IS NULL),
  cloned_from TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coin_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rows"
  ON coin_rows FOR ALL
  USING (
    table_id IN (SELECT id FROM coin_tables WHERE user_id = auth.uid())
  );


-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Optimized for the most common query patterns.

CREATE INDEX IF NOT EXISTS idx_coin_tables_user_id
  ON coin_tables(user_id);

CREATE INDEX IF NOT EXISTS idx_coin_rows_table_id
  ON coin_rows(table_id);

CREATE INDEX IF NOT EXISTS idx_coin_rows_date
  ON coin_rows(table_id, date);


-- ── Auto-create profile on signup ────────────────────────────────────────────
-- Trigger function that creates a profile row when a new user signs up.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, sync_enabled, premium_tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    TRUE,
    'free'
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── Updated_at auto-update ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_coin_tables_updated_at
  BEFORE UPDATE ON coin_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_coin_rows_updated_at
  BEFORE UPDATE ON coin_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
