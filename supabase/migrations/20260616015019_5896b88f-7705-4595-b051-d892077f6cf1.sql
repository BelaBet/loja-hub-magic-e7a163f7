
-- ============================================================================
-- 1) lojas_config_fiscal — remove ALL client-role access to fiscal credentials
--    Only edge functions using service_role may read or write cert/csc fields.
-- ============================================================================
DROP POLICY IF EXISTS lojas_config_fiscal_admin_select ON public.lojas_config_fiscal;
DROP POLICY IF EXISTS lojas_config_fiscal_admin_insert ON public.lojas_config_fiscal;
DROP POLICY IF EXISTS lojas_config_fiscal_admin_update ON public.lojas_config_fiscal;

REVOKE ALL ON public.lojas_config_fiscal FROM anon, authenticated;
GRANT  ALL ON public.lojas_config_fiscal TO service_role;

-- Safe RPC: returns ONLY non-sensitive fiscal config fields, and booleans
-- indicating whether the secret credentials are configured (without exposing them).
CREATE OR REPLACE FUNCTION public.get_loja_fiscal_config_safe()
RETURNS TABLE (
  loja_id uuid,
  ambiente text,
  regime_tributario text,
  serie_nfe text,
  serie_nfce text,
  ultimo_numero_nfe integer,
  ultimo_numero_nfce integer,
  has_certificado boolean,
  has_csc boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.loja_id,
    f.ambiente,
    f.regime_tributario,
    f.serie_nfe,
    f.serie_nfce,
    f.ultimo_numero_nfe,
    f.ultimo_numero_nfce,
    (f.cert_pfx_url IS NOT NULL AND f.cert_senha IS NOT NULL) AS has_certificado,
    (f.csc_token IS NOT NULL AND f.csc_id IS NOT NULL) AS has_csc,
    f.updated_at
  FROM public.lojas_config_fiscal f
  WHERE f.loja_id = public.get_loja_id()
    AND public.has_loja_role(f.loja_id, 'admin');
$$;

REVOKE ALL ON FUNCTION public.get_loja_fiscal_config_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loja_fiscal_config_safe() TO authenticated;

-- ============================================================================
-- 2) vendas — strip split_rules + seller_recipient_id from client SELECT.
--    These rows must never be readable by client roles; only service_role
--    (edge functions / webhook) needs them. INSERT/UPDATE/DELETE remain at the
--    table level so existing flows (PDV, Pagarme integration) keep working.
-- ============================================================================
REVOKE SELECT ON public.vendas FROM anon, authenticated;

GRANT SELECT (
  id, loja_id, cliente_id, vendedor_id, vendedor_nome,
  total, desconto, forma_pagamento, status, observacoes,
  created_at, updated_at,
  pagamento_status, pagarme_order_id, pagarme_charge_id, paid_at,
  base_amount, platform_amount, seller_amount, installments,
  device_serial, payment_channel,
  recibo_url, coupon_code, coupon_discount
) ON public.vendas TO authenticated;

-- service_role keeps full access (unchanged)
GRANT ALL ON public.vendas TO service_role;
