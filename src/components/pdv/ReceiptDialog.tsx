import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, MessageCircle } from "lucide-react";
import { brl } from "@/lib/format";
import type { PDVCartItem, PDVPayment } from "./types";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReceiptData {
  venda_id: string;
  items: PDVCartItem[];
  total: number;
  payment: PDVPayment;
  date: Date;
  loja_nome?: string;
  cliente_id?: string | null;
  cliente_telefone?: string | null;
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
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!data) return;
    setPhone(data.cliente_telefone ?? "");
    if (!data.cliente_telefone && data.cliente_id) {
      supabase
        .from("clientes")
        .select("telefone")
        .eq("id", data.cliente_id)
        .maybeSingle()
        .then(({ data: c }) => {
          if (c?.telefone) setPhone(c.telefone);
        });
    }
  }, [data]);

  if (!data) return null;
  const handlePrint = () => window.print();

  const buildMessage = () => {
    const lines: string[] = [];
    lines.push(`*${data.loja_nome ?? "Comprovante"}*`);
    lines.push(`Venda #${data.venda_id.slice(0, 8)}`);
    lines.push(`Data: ${data.date.toLocaleString("pt-BR")}`);
    lines.push("");
    lines.push("*Itens:*");
    for (const it of data.items) {
      lines.push(`• ${it.qty}× ${it.product.nome} — ${brl(it.subtotal)}`);
    }
    lines.push("");
    lines.push(`*Total: ${brl(data.total)}*`);
    lines.push(`Pagamento: ${PAYMENT_LABEL[data.payment]}`);
    lines.push("");
    lines.push("Obrigado pela preferência!");
    return lines.join("\n");
  };

  const sendWhats = () => {
    const digits = phone.replace(/\D/g, "");
    if (phone && digits.length < 10) {
      toast.error("Telefone inválido");
      return;
    }
    const text = encodeURIComponent(buildMessage());
    const url = digits
      ? `https://wa.me/${digits.length <= 11 ? "55" + digits : digits}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 print:hidden">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle>Comprovante de venda</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-4 max-h-[60vh] overflow-y-auto">
          <ReceiptBody data={data} />
        </div>
        <div className="px-5 py-3 border-t bg-muted/30 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="wa-phone" className="text-xs">Telefone do cliente (opcional)</Label>
            <Input
              id="wa-phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9"
            />
          </div>
          <Button onClick={sendWhats} className="w-full bg-[#25D366] text-white hover:bg-[#25D366]/90">
            <MessageCircle className="w-4 h-4 mr-1.5" /> Enviar recibo por WhatsApp
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4 mr-1.5" /> Fechar
            </Button>
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1.5" /> Imprimir
            </Button>
          </div>
        </div>
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