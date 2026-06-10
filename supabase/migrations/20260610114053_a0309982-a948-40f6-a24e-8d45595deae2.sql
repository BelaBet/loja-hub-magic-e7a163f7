
-- 1) Column-level restriction: hide sensitive fiscal credentials from clients
REVOKE SELECT (cert_senha, csc_token, csc_id, cert_pfx_url) ON public.lojas_config_fiscal FROM authenticated, anon;

-- 2) Column-level restriction: hide payment split internals from clients
REVOKE SELECT (split_rules, seller_recipient_id) ON public.vendas FROM authenticated, anon;

-- 3) Lock down SECURITY DEFINER functions: revoke from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION public.has_loja_role(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_loja_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_app_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_loja_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_loja_id_v2() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_loja_pagarme_recipient() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_loja_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_loja_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_app_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loja_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loja_id_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loja_pagarme_recipient() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) TO authenticated;

-- 4) Trigger functions: not meant to be called by API clients
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.baixar_estoque_venda() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_loja_para_novo_usuario() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_loja_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_nota_fiscal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_venda() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_movimentacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vendas_protect_financial_fields() FROM PUBLIC, anon, authenticated;
