-- ── Supabase PostgreSQL Database Schema — Assistente Moeda ──
-- Reflects the unified local DB state (Tables, Rows, Settings, Goals)
-- Enables Row Level Security (RLS) policies for strict tenant separation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. PROFILES TABLE ──
-- Stores user accounts metadata and premium subscription status
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  premium_tier TEXT DEFAULT 'free',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── 2. USER SETTINGS TABLE ──
-- Stores server budget cost controls, subscription details and global goals
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_cost_current_month NUMERIC(10, 2) DEFAULT 0.00,
  ai_cost_last_reset TEXT DEFAULT '',
  subscription_type TEXT DEFAULT 'free',
  goals JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── 3. COIN TABLES ──
-- Stores spreadsheet collection profiles (including table-level overrides)
CREATE TABLE IF NOT EXISTS public.coin_tables (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  goals JSONB DEFAULT '{}'::jsonb,
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE public.coin_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own coin tables"
  ON public.coin_tables FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. TRANSACTIONS TABLE ──
-- Stores individual financial items (deposits, expenses, revenues, etc.)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES public.coin_tables(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value NUMERIC(15, 2) NOT NULL,
  description TEXT,
  entry_type TEXT DEFAULT 'revenue',
  monthly_value NUMERIC(15, 2),
  month_count INTEGER,
  period_start TEXT,
  period_end TEXT,
  generated_by TEXT,
  cloned_from TEXT,
  updated_at TEXT NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their transactions if they own the parent table
CREATE POLICY "Users can manage their own transactions"
  ON public.transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coin_tables
      WHERE public.coin_tables.id = public.transactions.table_id
      AND public.coin_tables.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coin_tables
      WHERE public.coin_tables.id = public.transactions.table_id
      AND public.coin_tables.user_id = auth.uid()
    )
  );

-- ── AUTOMATIC PROFILE CREATION TRIGGER ──
-- Automatically inserts matching profile and user settings rows on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, sync_enabled, premium_tier)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', new.email), true, 'free');

  INSERT INTO public.user_settings (id, ai_cost_current_month, ai_cost_last_reset, subscription_type, goals)
  VALUES (new.id, 0.00, '', 'free', '{}'::jsonb);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. PROCESSED TRANSACTIONS TABLE ──
-- Idempotency log for unique transaction ids (Stripe session IDs, App Store / Google Play transaction IDs)
CREATE TABLE IF NOT EXISTS public.processed_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.processed_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own processed transactions"
  ON public.processed_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── 6. ATOMIC USER TOKEN INCREMENT RPC ──
-- Secure RPC function to atomically increment tokens without race conditions or duplication bugs
CREATE OR REPLACE FUNCTION public.increment_user_tokens(
  target_user_id UUID,
  token_increment_amount INT,
  transaction_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- If a transaction ID is provided, check for uniqueness to enforce idempotency
  IF transaction_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.processed_transactions (id, user_id)
      VALUES (transaction_id, target_user_id);
    EXCEPTION WHEN unique_violation THEN
      -- Duplicate transaction! Exit immediately to prevent double-crediting
      RETURN;
    END;
  END IF;

  -- Upsert user settings token balance
  INSERT INTO public.user_settings (id, token_balance, updated_at)
  VALUES (target_user_id, token_increment_amount, timezone('utc'::text, now()))
  ON CONFLICT (id)
  DO UPDATE SET
    token_balance = COALESCE(public.user_settings.token_balance, 0) + token_increment_amount,
    updated_at = timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
