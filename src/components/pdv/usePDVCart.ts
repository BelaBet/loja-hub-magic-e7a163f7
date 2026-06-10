import { useCallback, useState } from "react";
import type { PDVCartItem, PDVProduct } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function usePDVCart() {
  const [items, setItems] = useState<PDVCartItem[]>([]);
  const total = items.reduce((s, i) => s + i.subtotal, 0);

  const addItem = useCallback((product: PDVProduct, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const it = prev[idx];
        const newQty = it.qty + qty;
        const next = [...prev];
        next[idx] = { ...it, qty: newQty, subtotal: round2(it.unit_price * newQty) };
        return next;
      }
      return [
        ...prev,
        { product, qty, unit_price: product.preco_venda, subtotal: round2(product.preco_venda * qty) },
      ];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, qty, subtotal: round2(i.unit_price * qty) }
          : i
      )
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, total, addItem, removeItem, updateQty, clear };
}