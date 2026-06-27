-- Alertas operacionais visíveis para admin/gerente da loja.
-- Primeiro uso: avisar quando uma venda OFFLINE sincronizada usa um cupom
-- que já estava esgotado no momento do sync (a venda já ocorreu de fato
-- sem internet, então não pode ser bloqueada — mas a loja precisa saber
-- que aquele cupom passou do limite combinado).
CREATE TABLE IF NOT EXISTS public.alertas_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  detalhe text,
  referencia_id uuid,
  lido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alertas_operacionais_loja ON public.alertas_operacionais(loja_id, created_at DESC);
CREATE INDEX idx_alertas_operacionais_lido ON public.alertas_operacionais(loja_id, lido);

ALTER TABLE public.alertas_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_select_admin_gerente"
  ON public.alertas_operacionais FOR SELECT TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

CREATE POLICY "alertas_update_admin_gerente"
  ON public.alertas_operacionais FOR UPDATE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  )
  WITH CHECK (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

GRANT SELECT, UPDATE ON public.alertas_operacionais TO authenticated;
GRANT ALL ON public.alertas_operacionais TO service_role;

-- Nova função separada increment_coupon_usage_forcado: sempre incrementa
-- (mesmo passando do limite) e indica via "estourou_limite" se isso
-- aconteceu, para que o caller decida o que fazer. Usada apenas no sync de
-- vendas offline, onde a venda já ocorreu de fato e não pode ser bloqueada.
-- O fluxo online (PDV) continua usando a função increment_coupon_usage(uuid)
-- (definida em 20260626183000_fix_coupon_usage_race.sql), que é atômica e
-- BLOQUEIA o incremento quando o limite já foi atingido.
CREATE OR REPLACE FUNCTION public.increment_coupon_usage_forcado(p_coupon_id uuid)
RETURNS TABLE(incrementado boolean, estourou_limite boolean, loja_id uuid, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_uses int;
  v_used_count int;
  v_loja_id uuid;
  v_code text;
BEGIN
  UPDATE public.cupons c
     SET used_count = used_count + 1,
         updated_at = now()
   WHERE c.id = p_coupon_id
  RETURNING c.max_uses, c.used_count, c.loja_id, c.code
    INTO v_max_uses, v_used_count, v_loja_id, v_code;

  IF v_loja_id IS NULL THEN
    RETURN QUERY SELECT false, false, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, (v_used_count > v_max_uses), v_loja_id, v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_usage_forcado(uuid) TO authenticated;
