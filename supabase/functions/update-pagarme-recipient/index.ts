// Atualiza lojas.pagarme_recipient_id com segurança.
//
// Por quê uma function dedicada em vez de update direto pelo cliente:
// 1) recipient_id controla PARA ONDE vai o split de cada venda da loja no
//    Pagar.me — um valor errado (typo) redireciona pagamentos silenciosamente,
//    só descoberto quando o dinheiro não cai na conta certa. Por isso existe
//    um trigger no banco (lojas_protect_pagarme_recipient_trg) que bloqueia
//    qualquer alteração feita por quem não é super_admin.
// 2) Antes de salvar, essa function CONSULTA o Pagar.me pra confirmar que o
//    recipient_id realmente existe e está ativo — evita salvar um ID
//    inválido/desativado que só quebraria no primeiro split da próxima venda.
//
// Auth: Bearer JWT do usuário (precisa ser super_admin — checagem via RPC
// is_super_admin() com o client user-scoped, não apenas confiança no client).
// Body: { loja_id: string, recipient_id: string | null, dry_run?: boolean }
//   dry_run=true só valida contra o Pagar.me, não salva nada (usado pra
//   "testar conexão" do recipient já salvo, sem editar).

import { createClient } from "npm:@supabase/supabase-js@2";
import { assertSellerRecipientId, PlatformRecipientError } from "../_shared/platformRecipient.ts";

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";
const RECIPIENT_ID_RE = /^re_[a-zA-Z0-9]+$/;

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ─── 1. Autenticação + checagem de super_admin ───────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);

    const { data: isSuper, error: superErr } = await userClient.rpc("is_super_admin");
    if (superErr || isSuper !== true) {
      return json({ error: "Apenas super administradores podem alterar o recipient de pagamentos." }, 403);
    }

    // ─── 2. Body ───────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    const loja_id: string | undefined = body?.loja_id;
    const dryRun: boolean = body?.dry_run === true;
    const recipientIdRaw: string | null = body?.recipient_id ?? null;
    const recipientId = recipientIdRaw ? recipientIdRaw.trim() : null;

    if (!loja_id) return json({ error: "loja_id é obrigatório" }, 400);

    if (recipientId && !RECIPIENT_ID_RE.test(recipientId)) {
      return json({ error: "Formato inválido. Esperado: re_xxxxxxxxxxxxxxxx" }, 400);
    }

    // Mesma invariante aplicada em create-order/create-pos-order: o recipient
    // de uma loja nunca pode ser igual ao recipient da própria plataforma
    // (evitaria o split funcionar corretamente e confundiria os repasses).
    if (recipientId) {
      try {
        assertSellerRecipientId(recipientId);
      } catch (e) {
        if (e instanceof PlatformRecipientError) return json({ error: e.message }, 422);
        throw e;
      }
    }

    const secretKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!secretKey) return json({ error: "PAGARME_SECRET_KEY não configurada" }, 500);

    // ─── 3. Valida o recipient direto no Pagar.me antes de salvar ───────────
    let recipientInfo: { id: string; name?: string; status?: string; email?: string } | null = null;
    if (recipientId) {
      const res = await fetch(`${PAGARME_BASE_URL}/recipients/${recipientId}`, {
        headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return json(
          { error: `Recipient não encontrado no Pagar.me: ${data?.message ?? res.statusText}` },
          422,
        );
      }
      recipientInfo = {
        id: data?.id,
        name: data?.name ?? data?.default_bank_account?.holder_name,
        status: data?.status,
        email: data?.email,
      };
      if (recipientInfo.status && recipientInfo.status !== "active") {
        return json(
          {
            error: `Este recipient existe no Pagar.me, mas está com status "${recipientInfo.status}" (não "active"). Confirme antes de vincular.`,
            recipient: recipientInfo,
            requires_confirmation: true,
          },
          422,
        );
      }
    }

    if (dryRun) {
      return json({ ok: true, dry_run: true, recipient: recipientInfo });
    }

    // ─── 4. Salva via service_role (o trigger de proteção só bloqueia quando
    //        auth.uid() aponta pra um usuário comum; aqui não há JWT de usuário
    //        no contexto da query, então o trigger deixa passar). ────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lojaAntes } = await admin
      .from("lojas")
      .select("id, nome, pagarme_recipient_id")
      .eq("id", loja_id)
      .maybeSingle();
    if (!lojaAntes) return json({ error: "Loja não encontrada" }, 404);

    const { error: updateErr } = await admin
      .from("lojas")
      .update({ pagarme_recipient_id: recipientId, updated_at: new Date().toISOString() })
      .eq("id", loja_id);
    if (updateErr) {
      console.error("Erro ao salvar recipient_id:", updateErr.message);
      return json({ error: updateErr.message }, 500);
    }

    // Auditoria — fica visível no sino de alertas (AlertsBell) da própria loja.
    const { data: userInfo } = await userClient.auth.getUser();
    await admin.from("alertas_operacionais").insert({
      loja_id,
      tipo: "pagarme_recipient_alterado",
      titulo: recipientId
        ? "Recipient de pagamentos atualizado"
        : "Recipient de pagamentos removido",
      detalhe: recipientId
        ? `O recipient_id de pagamentos foi alterado de "${lojaAntes.pagarme_recipient_id ?? "(vazio)"}" para "${recipientId}" ` +
          `por ${userInfo.user?.email ?? "um super administrador"}. Recipient confirmado no Pagar.me: ${recipientInfo?.name ?? recipientId} (status: ${recipientInfo?.status ?? "?"}).`
        : `O recipient_id de pagamentos ("${lojaAntes.pagarme_recipient_id}") foi removido por ${userInfo.user?.email ?? "um super administrador"}. ` +
          `Novas vendas com split não terão para onde direcionar o repasse até que um novo recipient seja vinculado.`,
      referencia_id: null,
    });

    return json({ ok: true, recipient: recipientInfo, loja: { id: loja_id, nome: lojaAntes.nome } });
  } catch (err) {
    console.error("Erro em update-pagarme-recipient:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});
