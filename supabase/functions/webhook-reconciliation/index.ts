// Reconciliação periódica de pagamentos Pagar.me "travados".
//
// Por quê: se um webhook nunca chega (Pagar.me não conseguiu entregar, DNS,
// timeout, credencial trocada, etc.), NENHUM registro é gravado em
// webhook_logs — não tem o que auditar ali. A única forma confiável de
// detectar esse caso é comparar periodicamente o que o Pagar.me diz sobre
// o pedido com o que está gravado em `vendas`.
//
// O que faz: busca vendas com pagamento "pendente" (canal online ou pos) há
// mais de PENDENTE_MIN_MINUTOS, consulta o status real no Pagar.me, e:
//   - Se o Pagar.me também mostra pendente → cliente ainda não pagou, não é
//     falha nenhuma, ignora.
//   - Se o Pagar.me mostra pago/falhou/cancelado mas a venda continua
//     "pendente" → um webhook foi perdido. Corrige a venda automaticamente
//     E registra um alerta pra loja saber que isso aconteceu.
//
// Autenticação: header `x-cron-secret` == env RECONCILIATION_CRON_SECRET.
// Chamar via Supabase Cron Jobs (Dashboard → Database → Cron Jobs) apontando
// pra essa function a cada 10-15 min, ou via pg_cron + pg_net.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getPagarmeSecretKey } from "../_shared/pagarmeSecret.ts";

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";
const PENDENTE_MIN_MINUTOS = 15;
const PENDENTE_MAX_DIAS = 2; // não fica remoendo carrinho abandonado de semanas atrás
const LIMITE_POR_EXECUCAO = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedSecret = Deno.env.get("RECONCILIATION_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const secretKey = await getPagarmeSecretKey();
  if (!secretKey) return json({ error: "Chave do provedor de pagamentos não configurada. Um super administrador pode salvá-la em Configurações." }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoffRecente = new Date(Date.now() - PENDENTE_MIN_MINUTOS * 60_000).toISOString();
  const cutoffAntigo = new Date(Date.now() - PENDENTE_MAX_DIAS * 24 * 60 * 60_000).toISOString();

  const { data: pendentes, error: qErr } = await supabase
    .from("vendas")
    .select("id, loja_id, pagarme_order_id, pagamento_status, status, base_amount, split_rules, device_serial, payment_channel, created_at")
    .in("payment_channel", ["online", "pos"])
    .eq("pagamento_status", "pendente")
    .not("pagarme_order_id", "is", null)
    .lt("created_at", cutoffRecente)
    .gt("created_at", cutoffAntigo)
    .order("created_at", { ascending: true })
    .limit(LIMITE_POR_EXECUCAO);

  if (qErr) {
    console.error("Erro ao buscar vendas pendentes:", qErr.message);
    return json({ error: qErr.message }, 500);
  }

  let checados = 0;
  let corrigidos = 0;
  let erros = 0;
  const detalhes: unknown[] = [];

  for (const venda of pendentes ?? []) {
    checados++;
    try {
      const res = await fetch(`${PAGARME_BASE_URL}/orders/${venda.pagarme_order_id}`, {
        headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(`[reconciliation] erro ao consultar pedido ${venda.pagarme_order_id}:`, data);
        erros++;
        continue;
      }

      const orderStatus: string = data?.status ?? "unknown";
      const charge = data?.charges?.[0];
      const chargeStatus: string | undefined = charge?.status;
      const chargeId: string | undefined = charge?.id;
      const paidAtPagarme: string | undefined =
        charge?.paid_at ?? charge?.last_transaction?.paid_at ?? undefined;

      // Pedido ainda pendente no Pagar.me também → cliente não pagou, não é bug.
      if (
        (orderStatus === "pending" || orderStatus === "processing") &&
        chargeStatus !== "paid" &&
        chargeStatus !== "failed" &&
        chargeStatus !== "canceled" &&
        chargeStatus !== "refunded"
      ) {
        continue;
      }

      let novoPagamento: string | null = null;
      let novoStatus: string | null = null;
      let setPaidAt = false;
      if (chargeStatus === "paid" || orderStatus === "paid") {
        novoPagamento = "pago";
        novoStatus = "concluida";
        setPaidAt = true;
      } else if (chargeStatus === "failed" || chargeStatus === "not_authorized" || orderStatus === "failed") {
        novoPagamento = "falhou";
      } else if (orderStatus === "canceled" || chargeStatus === "canceled") {
        novoPagamento = "falhou";
        novoStatus = "cancelada";
      } else if (chargeStatus === "refunded") {
        novoPagamento = "falhou";
        novoStatus = "cancelada";
      }

      if (!novoPagamento) continue; // nada de acionável ainda

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (chargeId) updates.pagarme_charge_id = chargeId;
      updates.pagamento_status = novoPagamento;
      if (novoStatus) updates.status = novoStatus;
      if (setPaidAt) updates.paid_at = paidAtPagarme ?? new Date().toISOString();

      await supabase.from("vendas").update(updates).eq("id", venda.id);
      if (venda.device_serial) {
        await supabase
          .from("maquininhas")
          .update({ ultima_atividade: new Date().toISOString() })
          .eq("serial", venda.device_serial);
      }

      await supabase.from("alertas_operacionais").insert({
        loja_id: venda.loja_id,
        tipo: "webhook_perdido_reconciliado",
        titulo: `Webhook perdido — venda corrigida automaticamente (${novoPagamento})`,
        detalhe:
          `A venda ${venda.id} (pedido ${venda.pagarme_order_id}) ficou marcada como "pendente" por mais de ` +
          `${PENDENTE_MIN_MINUTOS} minutos porque o webhook do Pagar.me não chegou. A checagem periódica consultou ` +
          `o Pagar.me diretamente, confirmou que o status real é "${novoPagamento}" e corrigiu a venda automaticamente. ` +
          `Nenhuma ação é necessária, mas vale investigar se o webhook está configurado corretamente caso isso se repita.`,
        referencia_id: venda.id,
      });

      corrigidos++;
      detalhes.push({ venda_id: venda.id, pagarme_order_id: venda.pagarme_order_id, novo_status: novoPagamento });
    } catch (e) {
      console.error(`[reconciliation] erro ao processar venda ${venda.id}:`, e);
      erros++;
    }
  }

  console.log(`[reconciliation] checados=${checados} corrigidos=${corrigidos} erros=${erros}`);
  return json({ checados, corrigidos, erros, detalhes });
});
