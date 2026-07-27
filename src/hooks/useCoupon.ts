import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppliedCoupon, Coupon } from "@/components/pdv/coupon-types";

const round2 = (n: number) => Math.round(n * 100) / 100;

const calcDiscount = (coupon: Coupon, subtotal: number) =>
  coupon.type === "percentage"
    ? round2(subtotal * (Number(coupon.value) / 100))
    : round2(Math.min(Number(coupon.value), subtotal));

/**
 * `subtotal` é o total atual do carrinho (reativo). O desconto do cupom
 * aplicado é recalculado sempre que o carrinho muda — sem isso, o valor do
 * desconto ficava "congelado" no momento em que o cupom foi aplicado, então
 * adicionar/remover itens depois não refletia no desconto real (%) nem
 * revalidava o pedido mínimo.
 */
export function useCoupon(subtotal = 0) {
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appliedCoupon) return;
    const { coupon } = appliedCoupon;
    const minOrder = Number(coupon.min_order_value || 0);
    if (subtotal < minOrder) {
      setAppliedCoupon(null);
      setError(
        `Cupom removido: o carrinho ficou abaixo do pedido mínimo de R$ ${minOrder.toFixed(2).replace(".", ",")}`,
      );
      return;
    }
    const discount_amount = calcDiscount(coupon, subtotal);
    if (discount_amount !== appliedCoupon.discount_amount) {
      setAppliedCoupon({ coupon, discount_amount });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const validateAndApply = useCallback(
    async (rawCode: string, currentSubtotal: number): Promise<{ success: boolean; discount_amount?: number; error?: string }> => {
      const code = rawCode.trim().toUpperCase();
      if (!code) {
        const msg = "Informe o código do cupom";
        setError(msg);
        return { success: false, error: msg };
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: qErr } = await supabase
          .from("cupons" as any)
          .select("*")
          .eq("code", code)
          .maybeSingle();

        if (qErr) throw qErr;
        const coupon = data as unknown as Coupon | null;

        if (!coupon) return fail("Cupom não encontrado");
        if (!coupon.active) return fail("Cupom inativo");
        if (coupon.used_count >= coupon.max_uses) return fail("Cupom esgotado");
        if (coupon.expires_at) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const exp = new Date(coupon.expires_at + "T23:59:59");
          if (exp.getTime() < today.getTime()) return fail("Cupom expirado");
        }
        if (currentSubtotal < Number(coupon.min_order_value || 0)) {
          return fail(`Pedido mínimo de R$ ${Number(coupon.min_order_value).toFixed(2).replace(".", ",")}`);
        }

        const discount_amount = calcDiscount(coupon, currentSubtotal);

        setAppliedCoupon({ coupon, discount_amount });
        setError(null);
        return { success: true, discount_amount };
      } catch (e: any) {
        return fail(e?.message ?? "Erro ao validar cupom");
      } finally {
        setLoading(false);
      }

      function fail(msg: string) {
        setError(msg);
        setAppliedCoupon(null);
        return { success: false, error: msg };
      }
    },
    []
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setError(null);
  }, []);

  const useCouponUsage = useCallback(async (couponId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc("increment_coupon_usage" as any, { p_coupon_id: couponId });
    if (error) {
      console.error("[coupon] increment usage:", error.message);
      return false;
    }
    return data === true;
  }, []);

  // Estorna o uso do cupom quando a venda falha DEPOIS do incremento já ter
  // sido confirmado (ex.: estoque insuficiente bloqueou a venda no passo
  // seguinte). Evita que o cliente perca um uso do cupom numa compra que
  // não se concretizou.
  const releaseCouponUsage = useCallback(async (couponId: string): Promise<void> => {
    const { error } = await supabase.rpc("decrement_coupon_usage" as any, { p_coupon_id: couponId });
    if (error) console.error("[coupon] release usage:", error.message);
  }, []);

  return { appliedCoupon, loading, error, validateAndApply, removeCoupon, useCouponUsage, releaseCouponUsage };
}