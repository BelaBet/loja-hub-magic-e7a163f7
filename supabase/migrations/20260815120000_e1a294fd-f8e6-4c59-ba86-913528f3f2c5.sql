-- ─── Credenciais fiscais (Focus NFe), por loja ───────────────────────────
-- Mesmo padrão de public.plataforma_credenciais (usado pra PAGARME_SECRET_KEY):
-- nunca exposto a nenhum client, só a edge functions via service_role. Aqui é
-- por LOJA (cada loja tem seu próprio CNPJ/empresa cadastrada no Focus NFe),
-- diferente da credencial da plataforma que é global.
CREATE TABLE IF NOT EXISTS public.loja_credenciais_fiscais (
  loja_id uuid PRIMARY KEY REFERENCES public.lojas(id) ON DELETE CASCADE,
  focus_nfe_token text NOT NULL,
  last4 text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.loja_credenciais_fiscais TO service_role;

ALTER TABLE public.loja_credenciais_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no client access to loja_credenciais_fiscais"
ON public.loja_credenciais_fiscais
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE TRIGGER loja_credenciais_fiscais_set_updated_at
BEFORE UPDATE ON public.loja_credenciais_fiscais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Criação automática de nota fiscal pendente ao concluir uma venda ────
-- "As notas emitidas a partir das vendas aparecerão aqui" (texto já existente
-- na tela NotasFiscais.tsx) pressupõe que toda venda concluída ganha uma nota
-- 'pendente' automaticamente — cabe à loja emitir (manual, na tela) quando
-- estiver com a configuração fiscal pronta. NFC-e por padrão (venda de
-- balcão); a loja pode trocar pra NF-e manualmente se precisar.
CREATE OR REPLACE FUNCTION public.criar_nota_fiscal_pendente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF NOT EXISTS (SELECT 1 FROM public.notas_fiscais WHERE venda_id = NEW.id) THEN
      INSERT INTO public.notas_fiscais (loja_id, venda_id, tipo, status)
      VALUES (NEW.loja_id, NEW.id, 'nfce', 'pendente');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_nota_fiscal_pendente ON public.vendas;
CREATE TRIGGER trg_criar_nota_fiscal_pendente
AFTER INSERT OR UPDATE OF status ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.criar_nota_fiscal_pendente();
