
-- Nova função que considera active_loja_id do JWT
CREATE OR REPLACE FUNCTION public.get_loja_id_v2()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _claim_loja uuid;
  _resolved uuid;
BEGIN
  -- 1) Tentar ler active_loja_id de app_metadata
  BEGIN
    _claim_loja := NULLIF(
      (auth.jwt() -> 'app_metadata' ->> 'active_loja_id'),
      ''
    )::uuid;
  EXCEPTION WHEN OTHERS THEN
    _claim_loja := NULL;
  END;

  IF _claim_loja IS NOT NULL THEN
    SELECT loja_id INTO _resolved
    FROM public.loja_usuarios
    WHERE user_id = auth.uid() AND loja_id = _claim_loja
    LIMIT 1;
    IF _resolved IS NOT NULL THEN
      RETURN _resolved;
    END IF;
  END IF;

  -- 2) Fallback: primeira loja do usuário
  SELECT loja_id INTO _resolved
  FROM public.loja_usuarios
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC, loja_id ASC
  LIMIT 1;

  RETURN _resolved;
END;
$$;

-- Substituir get_loja_id() para delegar à v2 (mantém compatibilidade)
CREATE OR REPLACE FUNCTION public.get_loja_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.get_loja_id_v2();
$$;
