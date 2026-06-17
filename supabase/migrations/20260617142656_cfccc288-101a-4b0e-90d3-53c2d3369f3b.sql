DROP POLICY IF EXISTS "cupons update por loja admin/gerente" ON public.cupons;
CREATE POLICY "cupons update por loja admin/gerente" ON public.cupons
FOR UPDATE
USING (
  loja_id = public.get_loja_id()
  AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
)
WITH CHECK (
  loja_id = public.get_loja_id()
  AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
);