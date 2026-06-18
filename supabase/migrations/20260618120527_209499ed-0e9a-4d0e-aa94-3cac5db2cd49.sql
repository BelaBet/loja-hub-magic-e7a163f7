
-- Restrict DELETE on clientes to admin/gerente
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;
CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

-- Restrict DELETE on estoque to admin/gerente
DROP POLICY IF EXISTS "estoque_delete" ON public.estoque;
CREATE POLICY "estoque_delete" ON public.estoque
  FOR DELETE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

-- Restrict DELETE on produtos to admin/gerente
DROP POLICY IF EXISTS "produtos_delete" ON public.produtos;
CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

-- Add explicit role-restricted DELETE on recibos (admin/gerente only)
DROP POLICY IF EXISTS "recibos_delete" ON public.recibos;
CREATE POLICY "recibos_delete" ON public.recibos
  FOR DELETE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

-- Defense-in-depth: restrict UPDATE on vendas to admin/gerente at RLS level
-- (trigger vendas_protect_financial_fields remains as additional layer)
DROP POLICY IF EXISTS "vendas_update" ON public.vendas;
CREATE POLICY "vendas_update" ON public.vendas
  FOR UPDATE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  )
  WITH CHECK (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );
