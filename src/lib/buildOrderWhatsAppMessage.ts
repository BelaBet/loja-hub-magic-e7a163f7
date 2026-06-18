import { brl } from "@/lib/format";
import type { CatalogCartItem } from "@/hooks/useCatalogCart";

export type CheckoutInfo = {
  nome: string;
  whatsapp: string;
  observacoes?: string;
};

export function buildOrderWhatsAppMessage(
  lojaNome: string,
  items: CatalogCartItem[],
  total: number,
  cliente: CheckoutInfo,
) {
  const linhas = items.map(
    (i) =>
      `• ${i.qty}x ${i.nome} — ${brl(i.preco_venda)} = ${brl(i.preco_venda * i.qty)}`,
  );
  const partes = [
    `*Novo pedido — ${lojaNome}*`,
    "",
    `*Cliente:* ${cliente.nome}`,
    `*WhatsApp:* ${cliente.whatsapp}`,
    "",
    "*Itens:*",
    ...linhas,
    "",
    `*Total:* ${brl(total)}`,
  ];
  if (cliente.observacoes?.trim()) {
    partes.push("", `*Observações:* ${cliente.observacoes.trim()}`);
  }
  return partes.join("\n");
}