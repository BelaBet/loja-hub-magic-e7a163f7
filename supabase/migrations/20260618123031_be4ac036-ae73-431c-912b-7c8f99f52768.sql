
-- 1) CHECK constraint on loja_usuarios.role (defense in depth vs. trigger)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loja_usuarios_role_check'
      AND conrelid = 'public.loja_usuarios'::regclass
  ) THEN
    ALTER TABLE public.loja_usuarios
      ADD CONSTRAINT loja_usuarios_role_check
      CHECK (role IN ('admin','gerente','vendedor'));
  END IF;
END$$;

-- 2) Restrict venda_itens DELETE to admin/gerente of the loja
DROP POLICY IF EXISTS venda_itens_delete ON public.venda_itens;
CREATE POLICY venda_itens_delete ON public.venda_itens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.id = venda_itens.venda_id
        AND (
          public.has_loja_role(v.loja_id, 'admin')
          OR public.has_loja_role(v.loja_id, 'gerente')
        )
    )
  );

-- 3) Anon SELECT on the two public storage buckets so the public catalog can load images
DROP POLICY IF EXISTS "Public read product-images anon" ON storage.objects;
CREATE POLICY "Public read product-images anon"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Public read produtos anon" ON storage.objects;
CREATE POLICY "Public read produtos anon"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'produtos');
