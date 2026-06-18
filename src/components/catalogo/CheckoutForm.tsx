import { useState } from "react";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maskWhatsApp } from "@/components/recibos/masks";
import { MessageCircle } from "lucide-react";

export type CheckoutData = {
  nome: string;
  whatsapp: string;
  observacoes?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (data: CheckoutData) => void;
  brandColor: string;
};

export function CheckoutForm({ open, onOpenChange, onConfirm, brandColor }: Props) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const valid = nome.trim().length >= 2 && whatsapp.replace(/\D/g, "").length >= 10;

  const submit = () => {
    if (!valid) return;
    onConfirm({ nome: nome.trim(), whatsapp, observacoes });
    setNome("");
    setWhatsapp("");
    setObservacoes("");
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Finalizar pedido"
      description="Preencha seus dados para enviarmos o pedido pelo WhatsApp."
      contentClassName="max-w-md"
    >
      <div className="space-y-4 pb-2">
        <div className="space-y-1.5">
          <Label htmlFor="checkout-nome">Seu nome</Label>
          <Input
            id="checkout-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome completo"
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkout-wa">WhatsApp</Label>
          <Input
            id="checkout-wa"
            value={whatsapp}
            onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
            placeholder="(11) 99999-9999"
            inputMode="numeric"
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkout-obs">Observações (opcional)</Label>
          <Textarea
            id="checkout-obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Endereço, forma de pagamento, etc."
            rows={3}
            className="text-base"
          />
        </div>
        <Button
          className="w-full h-12 text-white hover:opacity-90"
          style={{ background: brandColor }}
          disabled={!valid}
          onClick={submit}
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          Enviar pedido pelo WhatsApp
        </Button>
      </div>
    </ResponsiveModal>
  );
}