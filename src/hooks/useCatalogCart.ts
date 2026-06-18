import { useCallback, useEffect, useMemo, useState } from "react";

export type CatalogCartItem = {
  id: string;
  nome: string;
  preco_venda: number;
  foto: string | null;
  qty: number;
  estoque: number | null;
};

const storageKey = (catalogId: string) => `catalog-cart:${catalogId}`;

function load(catalogId: string): CatalogCartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(catalogId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCatalogCart(catalogId: string | undefined) {
  const [items, setItems] = useState<CatalogCartItem[]>([]);

  useEffect(() => {
    if (!catalogId) return;
    setItems(load(catalogId));
  }, [catalogId]);

  useEffect(() => {
    if (!catalogId) return;
    try {
      localStorage.setItem(storageKey(catalogId), JSON.stringify(items));
    } catch {}
  }, [catalogId, items]);

  const addItem = useCallback((item: Omit<CatalogCartItem, "qty">, qty: number) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        const novaQty = next[idx].qty + qty;
        const max = item.estoque ?? Infinity;
        next[idx] = { ...next[idx], qty: Math.min(novaQty, max) };
        return next;
      }
      return [...prev, { ...item, qty }];
    });
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((p) => {
          if (p.id !== id) return p;
          const max = p.estoque ?? Infinity;
          return { ...p, qty: Math.max(1, Math.min(qty, max)) };
        })
        .filter((p) => p.qty > 0),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const totalItems = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const totalValue = useMemo(
    () => items.reduce((s, i) => s + i.qty * i.preco_venda, 0),
    [items],
  );

  return { items, addItem, updateQty, removeItem, clear, totalItems, totalValue };
}