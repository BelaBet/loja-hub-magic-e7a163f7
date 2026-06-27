-- Corrige condição de corrida no limite de uso de cupons (max_uses).
-- Antes, o UPDATE incrementava used_count sem checar o limite na mesma
-- operação — dois caixas aplicando o último uso disponível simultaneamente
-- podiam ambos passar a validação (feita separadamente, no client) e os
-- dois incrementos seriam aceitos, estourando max_uses.
--
-- Agora o limite é checado dentro do próprio UPDATE (atômico) e a função
-- retorna boolean indicando se o incremento foi aplicado. O caller deve
-- tratar `false` como "cupom esgotado" e desfazer o desconto na venda.
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE public.cupons
     SET used_count = used_count + 1,
         updated_at = now()
   WHERE id = p_coupon_id
     AND loja_id = public.get_loja_id()
     AND active = true
     AND used_count < max_uses
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_coupon_usage(uuid) TO authenticated;
