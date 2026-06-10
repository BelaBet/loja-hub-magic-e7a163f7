import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { brl } from "@/lib/format";
import type { PDVCartItem, PDVPayment } from "./types";

export interface ReceiptData {
  venda_id: string;
  items: PDVCartItem[];
  total: number;
  payment: PDVPayment;
  date: Date;
  loja_nome?: string;
}

const PAYMENT_LABEL: Record<PDVPayment, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_debito: "Cartão débito",
  cartao_credito: "Cartão crédito",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReceiptData | null;
}

export function ReceiptDialog({ open, onOpenChange, data }: Props) {
  if (!data) return null;
  const handlePrint = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 print:hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>Comprovante de venda</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-4 max-h-[60vh] overflow-y-auto">
          <ReceiptBody data={data} />
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 flex-row gap-2 sm:gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1.5" /> Fechar
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir / PDF
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Print-only mount: visible only on @media print */}
      <div id="pdv-print-receipt" className="hidden print:block">
        <ReceiptBody data={data} forPrint />
      </div>
    </Dialog>
  );
}

function ReceiptBody({ data, forPrint }: { data: ReceiptData; forPrint?: boolean }) {
  const dateStr = data.date.toLocaleString("pt-BR");
  return (
    <div className={forPrint ? "p-6 font-mono text-[12px] leading-snug" : "font-mono text-[12px] leading-snug"}>
      <div className="text-center mb-3">
        <p className="font-semibold text-sm uppercase">{data.loja_nome ?? "Comprovante"}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Comprovante não fiscal</p>
      </div>
      <div className="border-t border-dashed py-2 space-y-0.5 text-[11px]">
        <div className="flex justify-between"><span>Data</span><span>{dateStr}</span></div>
        <div className="flex justify-between"><span>Venda</span><span>#{data.venda_id.slice(0, 8)}</span></div>
      </div>
      <div className="border-t border-dashed pt-2 mt-1">
        <div className="flex justify-between font-semibold text-[11px] uppercase mb-1">
          <span>Item</span><span>Total</span>
        </div>
        <ul className="space-y-1.5">
          {data.items.map((it) => (
            <li key={it.product.id}>
              <div className="flex justify-between gap-2">
                <span className="flex-1 truncate">{it.product.nome}</span>
                <span className="shrink-0">{brl(it.subtotal)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {it.qty} × {brl(it.unit_price)}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-dashed mt-2 pt-2 space-y-0.5">
        <div className="flex justify-between text-sm font-semibold">
          <span>TOTAL</span><span>{brl(data.total)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span>Pagamento</span><span>{PAYMENT_LABEL[data.payment]}</span>
        </div>
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-4">
        Obrigado pela preferência!
      </p>
    </div>
  );
}