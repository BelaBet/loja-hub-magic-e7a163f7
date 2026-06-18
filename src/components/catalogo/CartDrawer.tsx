import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Trash2, Package, ShoppingBag } from "lucide-react";
import { brl } from "@/lib/format";
import { QuantitySelector } from "./QuantitySelector";
import type { CatalogCartItem } from "@/hooks/useCatalogCart";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: CatalogCartItem[];
  total: number;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  brandColor: string;
};

export function CartDrawer({
  open,
  onOpenChange,
  items,
  total,
  onUpdateQty,
  onRemove,
  onCheckout,
  brandColor,
}: Props) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Seu carrinho"
      contentClassName="max-w-lg"
    >
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10 mx-auto opacity-40" />
            <p className="mt-3">Seu carrinho está vazio</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[55vh] overflow-y-auto">
              {items.map((it) => (
                <div key={it.id} className="flex gap-3 border rounded-lg p-3">
                  <div className="h-16 w-16 rounded-md bg-muted flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {it.foto ? (
                      <img src={it.foto} alt={it.nome} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground opacity-40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-display font-semibold leading-tight line-clamp-2 text-sm">
                        {it.nome}
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mt-1 -mr-1 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(it.id)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="num text-sm text-muted-foreground mt-0.5">
                      {brl(it.preco_venda)} un.
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <QuantitySelector
                        value={it.qty}
                        onChange={(q) => onUpdateQty(it.id, q)}
                        max={it.estoque ?? undefined}
                        size="sm"
                      />
                      <div className="num font-bold" style={{ color: brandColor }}>
                        {brl(it.preco_venda * it.qty)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 flex items-center justify-between">
              <span className="mono text-xs uppercase tracking-widest text-muted-foreground">
                Total
              </span>
              <span className="num text-2xl font-bold" style={{ color: brandColor }}>
                {brl(total)}
              </span>
            </div>

            <Button
              className="w-full h-12 text-white hover:opacity-90"
              style={{ background: brandColor }}
              onClick={onCheckout}
            >
              Finalizar pedido
            </Button>
          </>
        )}
      </div>
    </ResponsiveModal>
  );
}