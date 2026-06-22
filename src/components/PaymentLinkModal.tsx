import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Copy, Check, X, RefreshCcw } from "lucide-react";
import { brl } from "@/lib/format";
import { usePaymentLink } from "@/hooks/usePaymentLink";

type Props = {
  open: boolean;
  amount: number; // reais
  description?: string;
  onClose: () => void;
};

export function PaymentLinkModal({ open, amount, description, onClose }: Props) {
  const { step, result, error, generateLink, reset } = usePaymentLink();
  const [copied, setCopied] = useState(false);

  const amountCents = Math.round(amount * 100);

  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleGenerate() {
    generateLink({
      amount: amountCents,
      description: description || "Venda PDV",
    });
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsApp() {
    if (!result) return;
    const msg = encodeURIComponent(
      `Olá! Segue o link para pagamento do seu pedido (${brl(amount)}):\n${result.url}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" /> Link de Pagamento
          </DialogTitle>
          <DialogDescription>
            Total:{" "}
            <span className="num font-bold text-foreground">{brl(amount)}</span>
            <span className="ml-2 text-xs">· PIX, boleto ou cartão</span>
          </DialogDescription>
        </DialogHeader>

        {/* IDLE */}
        {step === "idle" && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Gere um link de pagamento para o cliente pagar pelo celular — ele escolhe PIX, boleto ou cartão.
            </p>
            <Button onClick={handleGenerate} className="w-full h-11">
              Gerar Link de Pagamento
            </Button>
          </div>
        )}

        {/* GENERATING */}
        {step === "generating" && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Gerando link…
          </div>
        )}

        {/* READY */}
        {step === "ready" && result && (
          <div className="space-y-4 pt-2">
            {/* QR Code */}
            <div className="flex justify-center p-4 border rounded-xl bg-white">
              <QRCode value={result.url} size={180} />
            </div>

            {/* Link + copiar */}
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground truncate flex-1 font-mono">
                {result.url}
              </span>
              <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 h-7 px-2">
                {copied
                  ? <><Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Copiado</>
                  : <><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</>
                }
              </Button>
            </div>

            {/* Badge ID */}
            <div className="flex justify-center">
              <Badge variant="outline" className="mono text-[10px]">
                #{result.id.slice(-8).toUpperCase()}
              </Badge>
            </div>

            {/* WhatsApp */}
            <Button
              onClick={handleWhatsApp}
              className="w-full h-11 bg-[#25D366] hover:bg-[#1ebe5d] text-white"
            >
              📲 Enviar por WhatsApp
            </Button>

            <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="w-full">
              Fechar
            </Button>
          </div>
        )}

        {/* FAILED */}
        {step === "failed" && (
          <div className="text-center py-6 space-y-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <X className="h-6 w-6" />
            </div>
            <div className="font-bold">Erro ao gerar link</div>
            {error && <p className="text-sm text-muted-foreground">{error}</p>}
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={handleGenerate}>
                <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Tentar de novo
              </Button>
              <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
