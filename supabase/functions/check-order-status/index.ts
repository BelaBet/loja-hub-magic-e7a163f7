// Securely synchronizes an online Pagar.me order with the local sale.
// Body: { venda_id: string }
// The sale ownership is checked through the authenticated user's RLS context.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPagarmeSecretKey } from "../_shared/pagarmeSecret.ts";

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const { venda_id } = (await req.json()) ?? {};
    if (!venda_id || typeof venda_id !== "string") {
      return json({ error: "venda_id obrigatório" }, 400);
    }

    // Ownership check with the user's RLS context. Never expose an arbitrary
    // order lookup endpoint to the browser.
    const { data: ownedSale, error: ownError } = await supabase
      .from("vendas")
      .select("id, loja_id, pagarme_order_id, pagamento_status, status")
      .eq("id", venda_id)
      .maybeSingle();
    if (ownError || !ownedSale) return json({ error: "Venda não encontrada" }, 404);
    if (!ownedSale.pagarme_order_id) return json({ error: "Venda sem pedido Pagar.me" }, 400);

    const secretKey = await getPagarmeSecretKey();
    if (!secretKey) return json({ error: "Chave do provedor de pagamentos não configurada." }, 500);

    const response = await fetch(`${PAGARME_BASE_URL}/orders/${ownedSale.pagarme_order_id}`, {
      headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
    });
    const order = await response.json();
    if (!response.ok) {
      return json({ error: order?.message ?? "Erro ao consultar pedido", details: order }, response.status);
    }

    const charge = order?.charges?.[0];
    const chargeStatus = charge?.status ?? null;
    const orderStatus = order?.status ?? null;
    const chargeId = charge?.id ?? null;
    const paidAt = charge?.paid_at ?? charge?.last_transaction?.paid_at ?? null;

    let pagamentoStatus = ownedSale.pagamento_status;
    let vendaStatus = ownedSale.status;
    let paidAtValue: string | null = null;

    if (chargeStatus === "paid" || orderStatus === "paid") {
      pagamentoStatus = "pago";
      vendaStatus = "concluida";
      paidAtValue = paidAt ?? new Date().toISOString();
    } else if (
      chargeStatus === "failed" ||
      chargeStatus === "not_authorized" ||
      chargeStatus === "canceled" ||
      orderStatus === "failed" ||
      orderStatus === "canceled"
    ) {
      pagamentoStatus = "falhou";
      if (chargeStatus === "canceled" || orderStatus === "canceled") vendaStatus = "cancelada";
    }

    const changed = pagamentoStatus !== ownedSale.pagamento_status || vendaStatus !== ownedSale.status || !!chargeId;
    if (changed) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const update: Record<string, unknown> = {
        pagamento_status: pagamentoStatus,
        status: vendaStatus,
        updated_at: new Date().toISOString(),
      };
      if (chargeId) update.pagarme_charge_id = chargeId;
      if (paidAtValue) update.paid_at = paidAtValue;
      const { error: updateError } = await admin.from("vendas").update(update).eq("id", venda_id);
      if (updateError) throw updateError;
    }

    return json({
      venda_id,
      order_id: ownedSale.pagarme_order_id,
      order_status: orderStatus,
      charge_status: chargeStatus,
      pagamento_status: pagamentoStatus,
      status: vendaStatus,
      paid_at: paidAtValue,
      synced: changed,
    });
  } catch (error) {
    console.error("check-order-status:", error);
    return json({ error: error instanceof Error ? error.message : "Erro desconhecido" }, 500);
  }
});
