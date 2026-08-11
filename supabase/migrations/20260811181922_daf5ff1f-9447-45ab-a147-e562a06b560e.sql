-- 1) Restore Data API grants on loja_usuarios (missing grants broke storage policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loja_usuarios TO authenticated;
GRANT ALL ON public.loja_usuarios TO service_role;

-- 2) Security-definer helper to check membership by folder name
CREATE OR REPLACE FUNCTION public.can_write_loja_file(_folder text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _folder IS NULL OR _folder !~ '^[0-9a-fA-F-]{36}$' THEN
    RETURN false;
  END IF;
  _id := _folder::uuid;
  RETURN EXISTS (
    SELECT 1 FROM public.loja_usuarios lu
    WHERE lu.user_id = auth.uid() AND lu.loja_id = _id
  ) OR public.has_loja_network_access(_id) OR public.is_super_admin();
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_write_loja_file(text) TO authenticated;

-- 3) Rewrite storage policies for both buckets
DROP POLICY IF EXISTS produtos_loja_insert ON storage.objects;
DROP POLICY IF EXISTS produtos_loja_update ON storage.objects;
DROP POLICY IF EXISTS produtos_loja_select ON storage.objects;
DROP POLICY IF EXISTS produtos_loja_delete ON storage.objects;
DROP POLICY IF EXISTS product_images_loja_insert ON storage.objects;
DROP POLICY IF EXISTS product_images_loja_update ON storage.objects;
DROP POLICY IF EXISTS product_images_loja_select ON storage.objects;
DROP POLICY IF EXISTS product_images_loja_delete ON storage.objects;

CREATE POLICY produtos_loja_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('produtos','product-images') AND public.can_write_loja_file((storage.foldername(name))[1]));

CREATE POLICY produtos_loja_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('produtos','product-images') AND public.can_write_loja_file((storage.foldername(name))[1]))
  WITH CHECK (bucket_id IN ('produtos','product-images') AND public.can_write_loja_file((storage.foldername(name))[1]));

CREATE POLICY produtos_loja_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('produtos','product-images'));

CREATE POLICY produtos_loja_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('produtos','product-images') AND public.can_write_loja_file((storage.foldername(name))[1]));