const PAYHUB_URL = Deno.env.get("TECH_PAYHUB_INGEST_URL");
const PAYHUB_KEY = Deno.env.get("TECH_PAYHUB_API_KEY");
const PAYHUB_SOURCE_ID = Deno.env.get("TECH_PAYHUB_SOURCE_SYSTEM_ID");

export type PayHubSale = {
  external_id: string;
  occurred_at?: string;
  seller?: { external_id?: string | null; name?: string | null; email?: string | null; phone?: string | null };
  gross_amount_cents: number;
  platform_fee_cents?: number;
  gateway_fee_cents?: number;
  buyer_service_fee_cents?: number;
  recipient_net_cents?: number;
  payment_method?: string | null;
  provider_payment_id?: string | null;
  status?: string;
  paid_at?: string | null;
  currency?: string;
  loja_id?: string | null;
  metadata?: Record<string, unknown>;
};

export async function publishPayHubSale(eventType: "sale.created" | "sale.updated", sale: PayHubSale) {
  if (!PAYHUB_URL || !PAYHUB_KEY || !PAYHUB_SOURCE_ID) {
    console.warn("[payhub] integração não configurada; evento não enviado");
    return { ok: false, skipped: true };
  }

  const idempotencyKey = `loja-hub:${eventType}:${sale.external_id}:${sale.status ?? "na"}:${sale.paid_at ?? "na"}`;

  try {
    const response = await fetch(PAYHUB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-payhub-key": PAYHUB_KEY },
      body: JSON.stringify({
        source_system_id: PAYHUB_SOURCE_ID,
        external_id: sale.external_id,
        event_type: eventType,
        occurred_at: sale.occurred_at ?? new Date().toISOString(),
        idempotency_key: idempotencyKey,
        payload: sale,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("[payhub] ingest falhou", response.status, data);
      return { ok: false, status: response.status, data };
    }
    return { ok: true, data };
  } catch (error) {
    console.error("[payhub] erro ao publicar evento", error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
