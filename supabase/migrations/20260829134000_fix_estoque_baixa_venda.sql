-- Fixa a baixa de estoque para os fluxos que criam a venda antes dos itens
-- (PDV, checkout online e catálogo público).
--
-- Problema: o trigger antigo rodava no INSERT de vendas, mas vários fluxos
-- inserem venda_itens somente depois. Nesse momento não havia itens para
-- baixar. Além disso, uma venda do catálogo pode nascer como concluída e
-- pagamento pendente, e só depois virar paga.
--
-- A baixa agora acontece quando:
--   1) uma venda já concluída + paga recebe seus itens; OU
--   2) uma venda já concluída muda para pagamento_status = 'pago'.
--
-- estoque_baixado torna a operação idempotente e evita baixa dupla quando
-- os dois eventos acontecem próximos/concurrentemente.

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS estoque_baixado boolean NOT NULL DEFAULT false;

-- Vendas históricas não devem ser reprocessadas automaticamente por esta
-- migration. A conciliação do estoque histórico deve ser feita separadamente.
UPDATE public.vendas
SET estoque_baixado = true
WHERE estoque_baixado = false
  AND status = 'concluida'
  AND pagamento_status = 'pago';

CREATE OR REPLACE FUNCTION public.processar_baixa_estoque_venda(_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.vendas%ROWTYPE;
BEGIN
  -- Lock da venda: se dois gatilhos chegarem juntos, somente um processa.
  SELECT * INTO v
  FROM public.vendas
  WHERE id = _venda_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v.estoque_baixado THEN
    RETURN;
  END IF;

  IF v.status <> 'concluida' OR v.pagamento_status <> 'pago' THEN
    RETURN;
  END IF;

  -- Validação final de estoque dentro da mesma transação.
  -- Impede estoque negativo em vendas concorrentes.
  IF EXISTS (
    SELECT 1
    FROM public.venda_itens vi
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(e.quantidade), 0) AS quantidade
      FROM public.estoque e
      WHERE e.produto_id = vi.produto_id
        AND e.loja_id = v.loja_id
    ) est ON true
    WHERE vi.venda_id = v.id
      AND vi.produto_id IS NOT NULL
      AND est.quantidade < vi.quantidade
  ) THEN
    RAISE EXCEPTION 'Estoque insuficiente para concluir a venda %', v.id;
  END IF;

  INSERT INTO public.movimentacoes_estoque
    (loja_id, produto_id, tipo, quantidade, motivo, ref_venda_id)
  SELECT
    v.loja_id,
    vi.produto_id,
    'saida',
    vi.quantidade,
    'Venda #' || v.id,
    v.id
  FROM public.venda_itens vi
  WHERE vi.venda_id = v.id
    AND vi.produto_id IS NOT NULL;

  UPDATE public.estoque e
  SET quantidade = e.quantidade - vi.quantidade,
      updated_at = now()
  FROM public.venda_itens vi
  WHERE vi.venda_id = v.id
    AND e.produto_id = vi.produto_id
    AND e.loja_id = v.loja_id;

  UPDATE public.vendas
  SET estoque_baixado = true,
      updated_at = now()
  WHERE id = v.id;
END;
$$;

-- Substitui a lógica antiga de baixa no trigger de vendas.
CREATE OR REPLACE FUNCTION public.baixar_estoque_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.processar_baixa_estoque_venda(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.pagamento_status IS DISTINCT FROM OLD.pagamento_status THEN
      PERFORM public.processar_baixa_estoque_venda(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Quando a venda é criada antes dos itens, o trigger de vendas não encontra
-- itens. Este segundo trigger garante a baixa quando os itens finalmente
-- entram no banco.
DROP TRIGGER IF EXISTS on_venda_item_baixa_estoque ON public.venda_itens;
CREATE TRIGGER on_venda_item_baixa_estoque
  AFTER INSERT OR UPDATE ON public.venda_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.baixar_estoque_item_venda();

-- Helper específico para o trigger de venda_itens.
CREATE OR REPLACE FUNCTION public.baixar_estoque_item_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.processar_baixa_estoque_venda(NEW.venda_id);
  RETURN NEW;
END;
$$;
