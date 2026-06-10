import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, ShoppingCart, Plus, Minus, CreditCard } from "lucide-react";
import { brl } from "@/lib/format";
import type { PDVCartItem, PDVPayment } from "./types";

interface Props {
  items: PDVCartItem[];
  total: number;
  payment: PDVPayment;
  onPaymentChange: (p: PDVPayment) => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  loading?: boolean;
}

export function CartPanel({
  items, total, payment, onPaymentChange,
  onUpdateQty, onRemove, onClear, onCheckout, loading,
}: Props) {
  return (
    <aside className="flex flex-col h-full rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <ShoppingCart className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-medium text-sm flex-1">Carrinho</h2>
        {items.length > 0 && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onClear}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-6">
            <ShoppingCart className="w-10 h-10 opacity-20" />
            <p className="text-sm">Carrinho vazio</p>
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.product.id} className="px-4 py-3 flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{brl(item.unit_price)} / un</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <button onClick={() => onUpdateQty(item.product.id, item.qty - 1)} className="h-5 w-5 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted">
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-xs font-medium w-4 text-center">{item.qty}</span>
                    <button onClick={() => onUpdateQty(item.product.id, item.qty + 1)} className="h-5 w-5 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{brl(item.subtotal)}</p>
                  <button onClick={() => onRemove(item.product.id)} className="text-xs text-muted-foreground hover:text-destructive mt-1">
                    remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t px-4 py-4 space-y-3 bg-card">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Forma de pagamento</label>
            <Select value={payment} onValueChange={(v) => onPaymentChange(v as PDVPayment)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_debito">Cartão débito</SelectItem>
                <SelectItem value="cartao_credito">Cartão crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold">{brl(total)}</span>
          </div>
          <Button className="w-full h-11" onClick={onCheckout} disabled={loading}>
            <CreditCard className="w-4 h-4 mr-2" />
            {loading ? "Processando…" : "Finalizar venda"}
          </Button>
        </div>
      )}
    </aside>
  );
}