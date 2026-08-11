CREATE TABLE public.plataforma_credenciais (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  last4 text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.plataforma_credenciais TO service_role;

ALTER TABLE public.plataforma_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no client access to plataforma_credenciais"
ON public.plataforma_credenciais
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE TRIGGER plataforma_credenciais_set_updated_at
BEFORE UPDATE ON public.plataforma_credenciais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();