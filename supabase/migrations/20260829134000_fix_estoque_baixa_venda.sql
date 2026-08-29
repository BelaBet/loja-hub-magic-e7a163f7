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

-- Helper específico para os triggers de venda e venda_itens.
-- A função trava a venda, agrega itens repetidos e distribui a baixa entre
-- os depósitos sem descontar a mesma quantidade de cada depósito.
CREATE OR REPLACE FUNCTION public.processar_baixa_estoque_venda(_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.vendas%ROWTYPE;
  req record;
  est record;
  restante numeric;
  baixar numeric;
  estoque_total numeric;
BEGIN
  -- Lock da venda: se dois gatilhos chegarem juntos, somente um processa.
  SELECT * INTO v
  FROM public.vendas
  WHERE id = _venda_id
  FOR UPDATE;

  IF NOT FOUND OR v.estoque_baixado THEN
    RETURN;
  END IF;

  IF v.status <> 'concluida' OR v.pagamento_status <> 'pago' THEN
    RETURN;
  END IF;

  -- Se a venda foi criada antes dos itens, ainda não há nada para baixar.
  IF NOT EXISTS (
    SELECT 1 FROM public.venda_itens WHERE venda_id = v.id
  ) THEN
    RETURN;
  END IF;

  FOR req IN
    SELECT produto_id, SUM(quantidade) AS quantidade
    FROM public.venda_itens
    WHERE venda_id = v.id
      AND produto_id IS NOT NULL
    GROUP BY produto_id
  LOOP
    SELECT COALESCE(SUM(e.quantidade), 0)
      INTO estoque_total
    FROM public.estoque e
    WHERE e.produto_id = req.produto_id
      AND e.loja_id = v.loja_id;

    IF estoque_total < req.quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para concluir a venda %', v.id;
    END IF;

    restante := req.quantidade;

    -- Prioriza o depósito principal e depois os demais.
    FOR est IN
      SELECT e.id, e.quantidade
      FROM public.estoque e
      WHERE e.produto_id = req.produto_id
        AND e.loja_id = v.loja_id
        AND e.quantidade > 0
      ORDER BY CASE WHEN e.deposito = 'principal' THEN 0 ELSE 1 END, e.id
      FOR UPDATE
    LOOP
      EXIT WHEN restante <= 0;
      baixar := LEAST(est.quantidade, restante);

      UPDATE public.estoque
      SET quantidade = quantidade - baixar,
          updated_at = now()
      WHERE id = est.id;

      restante := restante - baixar;
    END LOOP;

    INSERT INTO public.movimentacoes_estoque
      (loja_id, produto_id, tipo, quantidade, motivo, ref_venda_id)
    VALUES
      (v.loja_id, req.produto_id, 'saida', req.quantidade, 'Venda #' || v.id, v.id);
  END LOOP;

  UPDATE public.vendas
  SET estoque_baixado = true,
      updated_at = now()
  WHERE id = v.id;
END;
$$;

-- Trigger de venda: cobre vendas que já possuam itens no momento da mudança
-- de status/pagamento.
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

-- Trigger específico de itens: necessário porque o app cria a venda antes
-- de inserir os itens em vários fluxos.
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

DROP TRIGGER IF EXISTS on_venda_item_baixa_estoque ON public.venda_itens;
CREATE TRIGGER on_venda_item_baixa_estoque
  AFTER INSERT OR UPDATE ON public.venda_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.baixar_estoque_item_venda();
