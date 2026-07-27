import { useCallback, useState } from "react";
import type { PDVCartItem, PDVProduct } from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function usePDVCart() {
  const [items, setItems] = useState<PDVCartItem[]>([]);
  const total = items.reduce((s, i) => s + i.subtotal, 0);

  const addItem = useCallback((product: PDVProduct, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      const maxQty = product.estoque_qtd > 0 ? product.estoque_qtd : qty;
      if (idx >= 0) {
        const it = prev[idx];
        const newQty = Math.min(maxQty, it.qty + qty);
        const next = [...prev];
        next[idx] = { ...it, qty: newQty, subtotal: round2(it.unit_price * newQty) };
        return next;
      }
      const cappedQty = Math.min(maxQty, qty);
      return [
        ...prev,
        { product, qty: cappedQty, unit_price: product.preco_venda, subtotal: round2(product.preco_venda * cappedQty) },
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
      prev.map((i) => {
        if (i.product.id !== productId) return i;
        const maxQty = i.product.estoque_qtd > 0 ? i.product.estoque_qtd : qty;
        const cappedQty = Math.min(qty, maxQty);
        return { ...i, qty: cappedQty, subtotal: round2(i.unit_price * cappedQty) };
      })
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, total, addItem, removeItem, updateQty, clear };
}