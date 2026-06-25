DROP POLICY IF EXISTS notas_fiscais_update ON public.notas_fiscais;
CREATE POLICY notas_fiscais_update ON public.notas_fiscais
  FOR UPDATE
  TO authenticated
  USING (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  WITH CHECK (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'));