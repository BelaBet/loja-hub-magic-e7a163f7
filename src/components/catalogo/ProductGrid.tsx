import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart } from "lucide-react";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QuantitySelector } from "@/components/catalogo/QuantitySelector";

type Product = {
  id: string;
  nome: string;
  sku: string | null;
  categoria: string | null;
  preco_venda: number;
  fotos: string[] | null;
  descricao: string | null;
  estoque: { quantidade: number }[];
};

type Props = {
  mode: "list" | "grid" | "instaview";
  accent: string;
  items: Product[];
  qtyByProduct: Record<string, number>;
  setQty: (id: string, value: number) => void;
  handleAdd: (product: Product) => void;
  setPreview: (product: Product) => void;
  oosBehavior: "hide" | "show_unavailable" | "show_normal";
  hasBg: boolean;
};

export function ProductGrid({
  mode,
  accent,
  items,
  qtyByProduct,
  setQty,
  handleAdd,
  setPreview,
  oosBehavior,
  hasBg,
}: Props) {
  const getStock = (product: Product) => product.estoque?.[0]?.quantidade ?? 0;

  if (mode === "list") {
    return (
      <div className="space-y-3">
        {items.map((product) => {
          const stock = getStock(product);
          const unavailable = stock <= 0;
          const qty = qtyByProduct[product.id] ?? 1;
          return (
            <Card
              key={product.id}
              className={cn(
                "p-3 flex gap-3 items-center",
                hasBg && "bg-white/95 shadow-xl ring-1 ring-black/5 backdrop-blur-sm",
              )}
            >
              <button type="button" onClick={() => setPreview(product)} className="shrink-0 rounded-lg overflow-hidden">
                {product.fotos?.[0] ? (
                  <img src={product.fotos[0]} alt={product.nome} className="h-20 w-20 object-cover" loading="lazy" />
                ) : (
                  <div className="h-20 w-20 bg-muted flex items-center justify-center"><Package className="h-7 w-7 opacity-30" /></div>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setPreview(product)} className="text-left font-semibold hover:underline">
                  {product.nome}
                </button>
                {product.categoria && <p className="text-xs text-muted-foreground truncate">{product.categoria}</p>}
                <div className="num font-bold mt-1">{brl(product.preco_venda)}</div>
              </div>
              <div className="hidden sm:block"><QuantitySelector value={qty} onChange={(v) => setQty(product.id, v)} max={stock > 0 ? stock : 1} size="sm" /></div>
              <Button
                type="button"
                disabled={unavailable}
                onClick={() => handleAdd(product)}
                className="shrink-0 text-white"
                style={{ background: accent }}
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-3",
      mode === "instaview" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    )}>
      {items.map((product) => {
        const stock = getStock(product);
        const unavailable = stock <= 0;
        const qty = qtyByProduct[product.id] ?? 1;
        return (
          <Card
            key={product.id}
            className={cn(
              "overflow-hidden group",
              hasBg && "bg-white/95 shadow-xl ring-1 ring-black/5 backdrop-blur-sm",
            )}
          >
            <button type="button" onClick={() => setPreview(product)} className="block w-full text-left">
              <div className={cn("relative overflow-hidden bg-muted", mode === "instaview" ? "aspect-square" : "aspect-square")}>
                {product.fotos?.[0] ? (
                  <img
                    src={product.fotos[0]}
                    alt={product.nome}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center"><Package className="h-10 w-10 opacity-25" /></div>
                )}
                {unavailable && oosBehavior !== "hide" && (
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Esgotado
                  </span>
                )}
              </div>
              <div className="p-3 pb-1">
                <h2 className="font-semibold leading-tight line-clamp-2">{product.nome}</h2>
                {product.categoria && <p className="text-xs text-muted-foreground mt-1 truncate">{product.categoria}</p>}
                <p className="num text-lg font-bold mt-2" style={{ color: accent }}>{brl(product.preco_venda)}</p>
              </div>
            </button>
            <div className="p-3 pt-2 flex items-center justify-between gap-2">
              <QuantitySelector value={qty} onChange={(v) => setQty(product.id, v)} max={stock > 0 ? stock : 1} size="sm" />
              <Button
                type="button"
                disabled={unavailable}
                onClick={() => handleAdd(product)}
                className="text-white flex-1"
                style={{ background: accent }}
              >
                <ShoppingCart className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
