-- Bloqueia a venda quando não há estoque suficiente para o produto.
-- Antes, baixar_estoque_venda() simplesmente subtraía a quantidade vendida
-- do estoque, podendo deixá-lo negativo sem nenhum aviso. Agora a validação
-- ocorre no momento em que os itens da venda são inseridos (venda_itens),
-- já que é nesse ponto que sabemos produto + quantidade + loja.
--
-- Decisão de produto: vendas sem estoque suficiente são BLOQUEADAS
-- (ver conversa com a Roberta em 26/06/2026).

CREATE OR REPLACE FUNCTION public.validar_estoque_disponivel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loja_id uuid;
  v_disponivel numeric(10,3);
  v_nome_produto text;
BEGIN
  -- Só valida produtos vinculados (itens "livres", sem produto_id, não são checados)
  IF new.produto_id IS NULL THEN
    RETURN new;
  END IF;

  SELECT loja_id INTO v_loja_id FROM public.vendas WHERE id = new.venda_id;

  -- Soma o estoque do produto em todos os depósitos da loja
  SELECT COALESCE(SUM(quantidade), 0) INTO v_disponivel
  FROM public.estoque
  WHERE produto_id = new.produto_id AND loja_id = v_loja_id;

  IF v_disponivel < new.quantidade THEN
    SELECT nome INTO v_nome_produto FROM public.produtos WHERE id = new.produto_id;
    RAISE EXCEPTION 'Estoque insuficiente para "%": disponível %, solicitado %',
      COALESCE(v_nome_produto, new.produto_id::text), v_disponivel, new.quantidade
      USING ERRCODE = 'P0001';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_estoque_disponivel ON public.venda_itens;
CREATE TRIGGER trg_validar_estoque_disponivel
  BEFORE INSERT ON public.venda_itens
  FOR EACH ROW EXECUTE FUNCTION public.validar_estoque_disponivel();

REVOKE EXECUTE ON FUNCTION public.validar_estoque_disponivel() FROM PUBLIC, anon, authenticated;
