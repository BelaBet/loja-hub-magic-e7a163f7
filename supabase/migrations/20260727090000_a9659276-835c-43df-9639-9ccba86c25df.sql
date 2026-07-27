-- Estorna o uso de um cupom quando a venda que o consumiu falha DEPOIS do
-- incremento (ex.: increment_coupon_usage() confirma o uso, mas a venda ou
-- os itens falham em seguida por estoque insuficiente). Sem isso, o cliente
-- perdia um uso do cupom numa compra que nunca se concretizou.
--
-- Espelha o guard de increment_coupon_usage (loja_id = get_loja_id()) e
-- nunca deixa used_count ficar negativo.
CREATE OR REPLACE FUNCTION public.decrement_coupon_usage(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE public.cupons
     SET used_count = GREATEST(used_count - 1, 0),
         updated_at = now()
   WHERE id = p_coupon_id
     AND loja_id = public.get_loja_id()
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_coupon_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrement_coupon_usage(uuid) TO authenticated;
