import { describe, expect, it } from "vitest";
import { normalizeItems } from "@/hooks/useCatalogCart";

describe("catalog cart normalization", () => {
  it("consolidates duplicate product lines into one line", () => {
    const items = normalizeItems([
      { id: "p1", nome: "Produto 1", preco_venda: 10, foto: null, qty: 2, estoque: 10 },
      { id: "p1", nome: "Produto 1", preco_venda: 10, foto: null, qty: 3, estoque: 10 },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("p1");
    expect(items[0].qty).toBe(5);
  });

  it("never exceeds stock while consolidating duplicates", () => {
    const items = normalizeItems([
      { id: "p1", nome: "Produto 1", preco_venda: 10, foto: null, qty: 3, estoque: 4 },
      { id: "p1", nome: "Produto 1", preco_venda: 10, foto: null, qty: 3, estoque: 4 },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(4);
  });

  it("drops invalid and non-positive lines", () => {
    const items = normalizeItems([
      null,
      {},
      { id: "", nome: "invalid", preco_venda: 10, foto: null, qty: 1, estoque: 10 },
      { id: "p0", nome: "zero", preco_venda: 10, foto: null, qty: 0, estoque: 10 },
      { id: "p1", nome: "ok", preco_venda: 10, foto: null, qty: 2, estoque: 10 },
    ]);

    expect(items).toEqual([
      { id: "p1", nome: "ok", preco_venda: 10, foto: null, qty: 2, estoque: 10 },
    ]);
  });
});
