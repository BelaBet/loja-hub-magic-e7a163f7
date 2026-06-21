
-- 1) Restrict notas_fiscais UPDATE to admin/gerente
DROP POLICY IF EXISTS notas_fiscais_update ON public.notas_fiscais;
CREATE POLICY notas_fiscais_update ON public.notas_fiscais
  FOR UPDATE
  USING (loja_id = public.get_loja_id() AND (public.has_loja_role(loja_id,'admin') OR public.has_loja_role(loja_id,'gerente')))
  WITH CHECK (loja_id = public.get_loja_id() AND (public.has_loja_role(loja_id,'admin') OR public.has_loja_role(loja_id,'gerente')));

-- 2) Remove cross-tenant network read on PII tables (clientes, recibos).
-- Network dashboards aggregate via SECURITY DEFINER RPCs; raw PII does not need cross-loja exposure.
DROP POLICY IF EXISTS "Network members can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Network members can view recibos" ON public.recibos;
