ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS recibo_config jsonb NOT NULL DEFAULT '{}'::jsonb;