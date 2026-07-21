-- ── SUPABASE SCHEMAS FOR MULTI-SECTOR TCO & COMPLIANCE ──

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  active_sectors TEXT[] DEFAULT '{personal_finance}',
  zero_knowledge_enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura do próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Permitir atualização do próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Permitir inserção do próprio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir exclusão do próprio perfil"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);


CREATE TABLE IF NOT EXISTS public.worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total do usuário às próprias planilhas"
  ON public.worksheets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID REFERENCES public.worksheets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  debit_account TEXT,
  credit_account TEXT,
  amount_in_cents BIGINT NOT NULL,
  description TEXT,
  reversal_ref_id UUID,
  sector_tags TEXT[],
  sector_metadata JSONB DEFAULT '{}'::jsonb,
  encrypted_payload TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total do usuário aos próprios lançamentos contábeis"
  ON public.ledger_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
