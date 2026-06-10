import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { brl } from "@/lib/format";
import type { PDVProduct } from "./types";

interface Props {
  product: PDVProduct;
  onAdd: (product: PDVProduct, qty: number) => void;
}

export function ProductCard({ product, onAdd }: Props) {
  const [qty, setQty] = useState(1);
  const change = (d: number) => setQty((q) => Math.max(1, q + d));
  const stockOk = product.estoque_qtd > 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-base truncate">{product.nome}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {product.ean && (
              <span className="font-mono text-xs text-muted-foreground">{product.ean}</span>
            )}
            {product.categoria && (
              <Badge variant="secondary" className="text-xs">{product.categoria}</Badge>
            )}
            <span className={`text-xs ${stockOk ? "text-primary" : "text-destructive"}`}>
              {stockOk ? `estoque: ${product.estoque_qtd}` : "sem estoque"}
            </span>
          </div>
        </div>
        <span className="text-xl font-semibold text-primary shrink-0">{brl(product.preco_venda)}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Qtd:</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => change(-1)}>
            <Minus className="h-3 w-3" />
          </Button>
          <span className="font-medium text-base w-6 text-center">{qty}</span>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => change(1)}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button onClick={() => { onAdd(product, qty); setQty(1); }} className="ml-auto h-9">
          <ShoppingCart className="w-4 h-4 mr-2" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}