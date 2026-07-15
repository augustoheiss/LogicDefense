-- ── 1. SPREADSHEET API KEYS TABLE ──
CREATE TABLE IF NOT EXISTS public.spreadsheet_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id TEXT UNIQUE NOT NULL REFERENCES public.coin_tables(id) ON DELETE CASCADE, -- Unique so one key per sheet
  key_hash TEXT UNIQUE NOT NULL,                       -- SHA-256 hash of the generated API key
  key_hint TEXT NOT NULL,                              -- Last 4 characters visible (e.g. "...8a9f")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  last_used_at TIMESTAMP WITH TIME ZONE,
  permissions TEXT DEFAULT 'read:write'                -- 'read-only' or 'read:write'
);

-- Enable RLS
ALTER TABLE public.spreadsheet_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy for spreadsheet_api_keys
CREATE POLICY "Users can manage their own spreadsheet API keys"
  ON public.spreadsheet_api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.coin_tables
      WHERE public.coin_tables.id = public.spreadsheet_api_keys.table_id
      AND public.coin_tables.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coin_tables
      WHERE public.coin_tables.id = public.spreadsheet_api_keys.table_id
      AND public.coin_tables.user_id = auth.uid()
    )
  );

-- Index on hash for O(1) validations
CREATE INDEX IF NOT EXISTS idx_spreadsheet_api_keys_hash ON public.spreadsheet_api_keys(key_hash);

-- ── 2. IDEMPOTENCY KEY ON TRANSACTIONS ──
-- Add column for idempotency
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Compound unique constraint to ensure unique transactions within a table
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS unique_table_idempotency;
ALTER TABLE public.transactions ADD CONSTRAINT unique_table_idempotency UNIQUE (table_id, idempotency_key);
