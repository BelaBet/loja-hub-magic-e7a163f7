import { brl } from "@/lib/format";
import { FORMA_LABEL, type Recibo, type ReciboConfig } from "./types";
import { whatsappDigits } from "./masks";

export function publicReciboUrl(reciboId: string) {
  if (typeof window === "undefined") return `/recibo/${reciboId}`;
  return `${window.location.origin}/recibo/${reciboId}`;
}

export function buildWhatsAppMessage(
  recibo: Pick<Recibo, "id" | "numero_formatado" | "cliente_nome" | "total" | "forma_pagamento">,
  template: string,
) {
  const link = publicReciboUrl(recibo.id);
  return template
    .replaceAll("{nome}", recibo.cliente_nome || "")
    .replaceAll("{numero}", recibo.numero_formatado)
    .replaceAll("{total}", brl(recibo.total))
    .replaceAll("{forma}", FORMA_LABEL[recibo.forma_pagamento] ?? recibo.forma_pagamento)
    .replaceAll("{link}", link);
}

export function openWhatsApp(
  recibo: Pick<Recibo, "id" | "numero_formatado" | "cliente_nome" | "cliente_whatsapp" | "total" | "forma_pagamento">,
  config: Pick<ReciboConfig, "template_whatsapp">,
) {
  const text = buildWhatsAppMessage(recibo, config.template_whatsapp);
  const phone = whatsappDigits(recibo.cliente_whatsapp);
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openEmail(
  recibo: Pick<Recibo, "id" | "numero_formatado" | "cliente_nome" | "cliente_email" | "total" | "forma_pagamento">,
  config: Pick<ReciboConfig, "template_whatsapp">,
) {
  const body = buildWhatsAppMessage(recibo, config.template_whatsapp);
  const subject = `Recibo ${recibo.numero_formatado}`;
  const to = recibo.cliente_email ?? "";
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}