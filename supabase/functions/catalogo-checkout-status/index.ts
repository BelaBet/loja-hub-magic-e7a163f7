// Consulta pública do status de um pedido do catálogo (polling do QR Code
// PIX na tela do cliente). Sem autenticação — protegido por dois filtros:
// 1) só aceita venda_id existente E com payment_channel = 'catalogo_publico'
//    (nunca expõe status de vendas internas via essa rota pública);
// 2) exige também o catalog_id (loja_id) batendo, pra não virar um oráculo
//    de "adivinhe o UUID" sobre pedidos de outras lojas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPagarmeSecretKey } from "../_shared/pagarmeSecret.ts";

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { venda_id, catalog_id } = (await req.json().catch(() => null)) ?? {};
    if (!venda_id || !catalog_id) return json({ error: "venda_id e catalog_id são obrigatórios" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: venda } = await admin
      .from("vendas")
      .select("id, loja_id, pagarme_order_id, pagamento_status, status, payment_channel")
      .eq("id", venda_id)
      .eq("loja_id", catalog_id)
      .eq("payment_channel", "catalogo_publico")
      .maybeSingle();
    if (!venda) return json({ error: "Pedido não encontrado" }, 404);
    if (!venda.pagarme_order_id) return json({ pagamento_status: venda.pagamento_status, status: venda.status });

    // Já pago/falhou/cancelado: não precisa consultar o Pagar.me de novo.
    if (venda.pagamento_status !== "pendente") {
      return json({ pagamento_status: venda.pagamento_status, status: venda.status });
    }

    const secretKey = await getPagarmeSecretKey();
    if (!secretKey) return json({ pagamento_status: venda.pagamento_status, status: venda.status });

    const res = await fetch(`${PAGARME_BASE_URL}/orders/${venda.pagarme_order_id}`, {
      headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
    });
    const order = await res.json().catch(() => null);
    if (!res.ok) return json({ pagamento_status: venda.pagamento_status, status: venda.status });

    const charge = order?.charges?.[0];
    const chargeStatus = charge?.status ?? null;
    const orderStatus = order?.status ?? null;

    let pagamentoStatus = venda.pagamento_status;
    let vendaStatus = venda.status;
    if (chargeStatus === "paid" || orderStatus === "paid") {
      pagamentoStatus = "pago";
      vendaStatus = "concluida";
    } else if (["failed", "not_authorized", "canceled"].includes(chargeStatus) || ["failed", "canceled"].includes(orderStatus)) {
      pagamentoStatus = "falhou";
      if (orderStatus === "canceled" || chargeStatus === "canceled") vendaStatus = "cancelada";
    }

    if (pagamentoStatus !== venda.pagamento_status || vendaStatus !== venda.status) {
      await admin.from("vendas").update({
        pagamento_status: pagamentoStatus,
        status: vendaStatus,
        pagarme_charge_id: charge?.id ?? null,
        paid_at: pagamentoStatus === "pago" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", venda_id);
    }

    return json({ pagamento_status: pagamentoStatus, status: vendaStatus });
  } catch (err) {
    console.error("Erro em catalogo-checkout-status:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});
