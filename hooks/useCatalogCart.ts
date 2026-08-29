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

function sanitizeQty(value: unknown, estoque: number | null) {
  const qty = Math.trunc(Number(value));
  if (!Number.isFinite(qty) || qty < 1) return 0;
  if (estoque != null) return Math.min(qty, Math.max(0, Math.trunc(estoque)));
  return qty;
}

/** Normaliza e consolida linhas repetidas do mesmo produto. */
export function normalizeItems(value: unknown): CatalogCartItem[] {
  if (!Array.isArray(value)) return [];
  const merged = new Map<string, CatalogCartItem>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<CatalogCartItem>;
    if (typeof item.id !== "string" || !item.id) continue;

    const estoque = item.estoque == null ? null : Number(item.estoque);
    const safeEstoque = estoque == null || !Number.isFinite(estoque)
      ? null
      : Math.max(0, Math.trunc(estoque));
    const qty = sanitizeQty(item.qty, safeEstoque);
    if (qty < 1) continue;

    const existing = merged.get(item.id);
    if (existing) {
      existing.qty = sanitizeQty(existing.qty + qty, safeEstoque);
      continue;
    }

    merged.set(item.id, {
      id: item.id,
      nome: String(item.nome ?? "Produto"),
      preco_venda: Number.isFinite(Number(item.preco_venda)) ? Number(item.preco_venda) : 0,
      foto: typeof item.foto === "string" ? item.foto : null,
      qty,
      estoque: safeEstoque,
    });
  }

  return Array.from(merged.values()).filter((item) => item.qty > 0);
}

function load(catalogId: string): CatalogCartItem[] {
  try {
    const raw = localStorage.getItem(storageKey(catalogId));
    if (!raw) return [];
    return normalizeItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function useCatalogCart(catalogId: string | undefined) {
  const [items, setItems] = useState<CatalogCartItem[]>([]);
  const [hydratedCatalogId, setHydratedCatalogId] = useState<string | null>(null);

  useEffect(() => {
    if (!catalogId) {
      setItems([]);
      setHydratedCatalogId(null);
      return;
    }

    const loaded = load(catalogId);
    setItems(loaded);
    setHydratedCatalogId(catalogId);

    try {
      localStorage.setItem(storageKey(catalogId), JSON.stringify(loaded));
    } catch {
      // Storage may be unavailable in private browsing or restricted environments.
    }
  }, [catalogId]);

  useEffect(() => {
    if (!catalogId || hydratedCatalogId !== catalogId) return;
    try {
      localStorage.setItem(storageKey(catalogId), JSON.stringify(normalizeItems(items)));
    } catch {
      // Storage may be unavailable in private browsing or restricted environments.
    }
  }, [catalogId, hydratedCatalogId, items]);

  const addItem = useCallback((item: Omit<CatalogCartItem, "qty">, qty: number) => {
    setItems((prev) => {
      const requestedQty = Math.trunc(Number(qty));
      if (!Number.isFinite(requestedQty) || requestedQty < 1) return prev;

      const max = item.estoque == null ? Infinity : Math.max(0, Math.trunc(item.estoque));
      if (max < 1) return prev;

      const idx = prev.findIndex((p) => p.id === item.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(next[idx].qty + requestedQty, max) };
        return next;
      }

      return [...prev, { ...item, qty: Math.min(requestedQty, max) }];
    });
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    setItems((prev) =>
      prev
        .map((p) => {
          if (p.id !== id) return p;
          const max = p.estoque == null ? Infinity : Math.max(0, Math.trunc(p.estoque));
          return { ...p, qty: Math.max(1, Math.min(Math.trunc(qty), max)) };
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
