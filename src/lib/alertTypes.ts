// Classifica os alertas de public.alertas_operacionais em duas categorias:
//
// - "negocio": relevante pro dia a dia do lojista (estoque, cupom, vendas)
//   → aparece no sino de notificações (AlertsBell) de cada loja.
// - "tecnico": infraestrutura/backend (webhook, recipient de pagamento,
//   chave de API) → aparece só em /admin/alertas-tecnicos, pra super admin.
//
// Um alerta cujo `tipo` não está listado aqui é tratado como "negocio" por
// padrão (mais seguro nunca esconder algo relevante do lojista por engano
// do que vazar ruído técnico pra ele).

export const TECHNICAL_ALERT_TYPES = new Set([
  "webhook_captura_falhou",
  "webhook_update_venda_falhou",
  "webhook_erro_inesperado",
  "webhook_perdido_reconciliado",
  "pagarme_recipient_alterado",
]);

export function isTechnicalAlertType(tipo: string): boolean {
  return TECHNICAL_ALERT_TYPES.has(tipo);
}
