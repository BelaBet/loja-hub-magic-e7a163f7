
-- ============================================================
-- RECIBOS DIGITAIS — tabelas, índices, RLS, triggers, RPCs
-- ============================================================

-- 1) recibos --------------------------------------------------
CREATE TABLE public.recibos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  ano int NOT NULL,
  numero_seq int NOT NULL,
  numero_formatado text NOT NULL,
  cliente_nome text NOT NULL,
  cliente_whatsapp text,
  cliente_email text,
  cliente_cpf text,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  desconto numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  forma_pagamento text NOT NULL DEFAULT 'dinheiro',
  valor_recebido numeric(12,2),
  troco numeric(12,2),
  observacao text,
  status text NOT NULL DEFAULT 'pago',
  motivo_cancelamento text,
  cancelado_em timestamptz,
  enviado_whatsapp_em timestamptz,
  enviado_email_em timestamptz,
  visualizado_em timestamptz,
  visualizacoes int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recibos_status_chk CHECK (status IN ('pago','pendente','cancelado')),
  CONSTRAINT recibos_forma_chk CHECK (forma_pagamento IN ('dinheiro','pix','credito','debito','boleto')),
  CONSTRAINT recibos_loja_ano_seq_unique UNIQUE (loja_id, ano, numero_seq)
);

CREATE INDEX recibos_loja_created_idx ON public.recibos(loja_id, created_at DESC);
CREATE INDEX recibos_loja_status_idx  ON public.recibos(loja_id, status);

GRANT SELECT, INSERT, UPDATE ON public.recibos TO authenticated;
GRANT SELECT ON public.recibos TO anon;
GRANT ALL ON public.recibos TO service_role;

ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;

-- Membros da loja: leitura/escrita completa por loja_id
CREATE POLICY "recibos select por loja" ON public.recibos
  FOR SELECT TO authenticated
  USING (loja_id = public.get_loja_id());

CREATE POLICY "recibos insert por loja" ON public.recibos
  FOR INSERT TO authenticated
  WITH CHECK (loja_id = public.get_loja_id());

CREATE POLICY "recibos update por loja" ON public.recibos
  FOR UPDATE TO authenticated
  USING (loja_id = public.get_loja_id())
  WITH CHECK (loja_id = public.get_loja_id());

-- Página pública: anon pode ler qualquer recibo pelo id (link público)
CREATE POLICY "recibos select publico anon" ON public.recibos
  FOR SELECT TO anon
  USING (true);

-- 2) recibos_config ------------------------------------------
CREATE TABLE public.recibos_config (
  loja_id uuid PRIMARY KEY REFERENCES public.lojas(id) ON DELETE CASCADE,
  template_ativo text NOT NULL DEFAULT 'padrao',
  loja_nome_exibicao text,
  loja_cnpj text,
  loja_endereco text,
  loja_telefone text,
  loja_logo_url text,
  mensagem_rodape text NOT NULL DEFAULT 'Obrigado pela preferência!',
  template_whatsapp text NOT NULL DEFAULT 'Olá {nome}! Segue seu recibo {numero} no valor de {total} ({forma}). Acesse: {link}',
  mostrar_logo boolean NOT NULL DEFAULT true,
  mostrar_endereco boolean NOT NULL DEFAULT true,
  mostrar_cnpj boolean NOT NULL DEFAULT true,
  mostrar_cpf_cliente boolean NOT NULL DEFAULT true,
  mostrar_troco boolean NOT NULL DEFAULT true,
  envio_automatico_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recibos_config_template_chk CHECK (template_ativo IN ('padrao','minimalista','dark'))
);

GRANT SELECT, INSERT, UPDATE ON public.recibos_config TO authenticated;
GRANT SELECT ON public.recibos_config TO anon;
GRANT ALL ON public.recibos_config TO service_role;

ALTER TABLE public.recibos_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recibos_config select por loja" ON public.recibos_config
  FOR SELECT TO authenticated
  USING (loja_id = public.get_loja_id());

CREATE POLICY "recibos_config insert por loja admin/gerente" ON public.recibos_config
  FOR INSERT TO authenticated
  WITH CHECK (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

CREATE POLICY "recibos_config update por loja admin/gerente" ON public.recibos_config
  FOR UPDATE TO authenticated
  USING (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  )
  WITH CHECK (
    loja_id = public.get_loja_id()
    AND (public.has_loja_role(loja_id, 'admin') OR public.has_loja_role(loja_id, 'gerente'))
  );

-- Página pública: anon pode ler config para renderizar identidade visual
CREATE POLICY "recibos_config select publico anon" ON public.recibos_config
  FOR SELECT TO anon
  USING (true);

-- 3) Triggers de updated_at ---------------------------------
CREATE TRIGGER recibos_set_updated_at
  BEFORE UPDATE ON public.recibos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER recibos_config_set_updated_at
  BEFORE UPDATE ON public.recibos_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Numeração sequencial por loja/ano ----------------------
CREATE OR REPLACE FUNCTION public.gerar_numero_recibo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ano int := EXTRACT(YEAR FROM now())::int;
  _next int;
BEGIN
  IF NEW.numero_formatado IS NOT NULL AND NEW.numero_formatado <> '' THEN
    RETURN NEW;
  END IF;
  -- Lock por loja+ano para evitar race
  PERFORM 1 FROM public.recibos
   WHERE loja_id = NEW.loja_id AND ano = _ano
   FOR UPDATE;

  SELECT COALESCE(MAX(numero_seq), 0) + 1
    INTO _next
    FROM public.recibos
   WHERE loja_id = NEW.loja_id AND ano = _ano;

  NEW.ano := _ano;
  NEW.numero_seq := _next;
  NEW.numero_formatado := 'REC-' || _ano::text || '-' || LPAD(_next::text, 5, '0');
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER recibos_gerar_numero
  BEFORE INSERT ON public.recibos
  FOR EACH ROW EXECUTE FUNCTION public.gerar_numero_recibo();

-- 5) RPC pública para registrar visualização ---------------
CREATE OR REPLACE FUNCTION public.incrementar_visualizacao_recibo(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recibos
     SET visualizacoes = visualizacoes + 1,
         visualizado_em = COALESCE(visualizado_em, now()),
         updated_at = now()
   WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.incrementar_visualizacao_recibo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.incrementar_visualizacao_recibo(uuid) TO anon, authenticated;
