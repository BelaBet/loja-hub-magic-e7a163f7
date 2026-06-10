CREATE OR REPLACE FUNCTION public.ensure_loja_for_current_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _loja_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT loja_id INTO _loja_id
  FROM public.loja_usuarios
  WHERE user_id = _uid
  ORDER BY created_at ASC
  LIMIT 1;

  IF _loja_id IS NOT NULL THEN
    RETURN _loja_id;
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  INSERT INTO public.lojas (nome, email)
  VALUES ('Minha Loja', COALESCE(_email, ''))
  RETURNING id INTO _loja_id;

  INSERT INTO public.loja_usuarios (loja_id, user_id, role)
  VALUES (_loja_id, _uid, 'admin');

  RETURN _loja_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_loja_for_current_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_loja_for_current_user() TO authenticated;