
-- Cupons de desconto por loja
CREATE TABLE IF NOT EXISTS public.cupons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id         uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  code            text NOT NULL,
  type            text NOT NULL DEFAULT 'percentage',
  value           numeric(10,2) NOT NULL CHECK (value > 0),
  min_order_value numeric(10,2) NOT NULL DEFAULT 0,
  max_uses        int NOT NULL DEFAULT 1,
  used_count      int NOT NULL DEFAULT 0,
  expires_at      date,
  description     text NOT NULL DEFAULT '',
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cupons_type_check CHECK (type IN ('percentage','fixed')),
  CONSTRAINT cupons_loja_code_unique UNIQUE (loja_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cupons TO authenticated;
GRANT ALL ON public.cupons TO service_role;

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cupons select por loja"
  ON public.cupons FOR SELECT TO authenticated
  USING (loja_id = public.get_loja_id());

CREATE POLICY "cupons insert por loja admin/gerente"
  ON public.cupons FOR INSERT TO authenticated
  WITH CHECK (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

CREATE POLICY "cupons update por loja admin/gerente"
  ON public.cupons FOR UPDATE TO authenticated
  USING (loja_id = public.get_loja_id())
  WITH CHECK (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

CREATE POLICY "cupons delete por loja admin"
  ON public.cupons FOR DELETE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND public.has_loja_role(loja_id, 'admin')
  );

CREATE TRIGGER trg_cupons_set_updated_at
  BEFORE UPDATE ON public.cupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Campos de cupom na venda
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric(12,2) NOT NULL DEFAULT 0;

-- Função para incrementar uso (RLS-safe)
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cupons
     SET used_count = used_count + 1,
         updated_at = now()
   WHERE id = p_coupon_id
     AND loja_id = public.get_loja_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) TO authenticated;
