
-- 1) Cupons UPDATE policy: restrict to authenticated role
DROP POLICY IF EXISTS "cupons update por loja admin/gerente" ON public.cupons;
CREATE POLICY "cupons update por loja admin/gerente"
ON public.cupons
FOR UPDATE
TO authenticated
USING (
  loja_id = public.get_loja_id()
  AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
)
WITH CHECK (
  loja_id = public.get_loja_id()
  AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
);

-- 2) Remove anon SELECT policies on recibos and recibos_config
DROP POLICY IF EXISTS "recibos select publico anon" ON public.recibos;
DROP POLICY IF EXISTS "recibos_config select publico anon" ON public.recibos_config;

REVOKE SELECT ON public.recibos FROM anon;
REVOKE SELECT ON public.recibos_config FROM anon;

-- 3) SECURITY DEFINER RPC returning only safe fields for public receipt page
CREATE OR REPLACE FUNCTION public.get_recibo_publico(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.recibos%ROWTYPE;
  c public.recibos_config%ROWTYPE;
  cpf_digits text;
  cpf_masked text;
  recibo_json jsonb;
  config_json jsonb;
BEGIN
  SELECT * INTO r FROM public.recibos WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO c FROM public.recibos_config WHERE loja_id = r.loja_id;

  -- mask CPF: keep only last 2 digits, only if config allows showing it
  IF r.cliente_cpf IS NOT NULL AND COALESCE(c.mostrar_cpf_cliente, true) THEN
    cpf_digits := regexp_replace(r.cliente_cpf, '\D', '', 'g');
    IF length(cpf_digits) >= 2 THEN
      cpf_masked := '***.***.***-' || right(cpf_digits, 2);
    END IF;
  END IF;

  recibo_json := jsonb_build_object(
    'id', r.id,
    'loja_id', r.loja_id,
    'numero_formatado', r.numero_formatado,
    'ano', r.ano,
    'numero_seq', r.numero_seq,
    'cliente_nome', r.cliente_nome,
    'cliente_cpf', cpf_masked,
    'itens', r.itens,
    'subtotal', r.subtotal,
    'desconto', r.desconto,
    'total', r.total,
    'forma_pagamento', r.forma_pagamento,
    'valor_recebido', r.valor_recebido,
    'troco', r.troco,
    'observacao', r.observacao,
    'status', r.status,
    'motivo_cancelamento', r.motivo_cancelamento,
    'cancelado_em', r.cancelado_em,
    'created_at', r.created_at
  );

  IF c.loja_id IS NULL THEN
    config_json := NULL;
  ELSE
    config_json := jsonb_build_object(
      'loja_id', c.loja_id,
      'template_ativo', c.template_ativo,
      'loja_nome_exibicao', c.loja_nome_exibicao,
      'loja_cnpj', CASE WHEN c.mostrar_cnpj THEN c.loja_cnpj ELSE NULL END,
      'loja_endereco', CASE WHEN c.mostrar_endereco THEN c.loja_endereco ELSE NULL END,
      'loja_telefone', c.loja_telefone,
      'loja_logo_url', CASE WHEN c.mostrar_logo THEN c.loja_logo_url ELSE NULL END,
      'mensagem_rodape', c.mensagem_rodape,
      'mostrar_logo', c.mostrar_logo,
      'mostrar_endereco', c.mostrar_endereco,
      'mostrar_cnpj', c.mostrar_cnpj,
      'mostrar_cpf_cliente', c.mostrar_cpf_cliente,
      'mostrar_troco', c.mostrar_troco
    );
  END IF;

  RETURN jsonb_build_object('recibo', recibo_json, 'config', config_json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recibo_publico(uuid) TO anon, authenticated;
