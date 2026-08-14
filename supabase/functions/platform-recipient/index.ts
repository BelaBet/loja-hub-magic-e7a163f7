// Gestão do recipient_id da PLATAFORMA (Ankor Tech) pelo super admin.
//
// GET    -> status: se está configurado, origem (banco/ambiente/fallback), valor.
// POST   -> { recipient_id } valida direto no Pagar.me e salva no banco.
// DELETE -> remove o valor salvo no banco (volta a usar o secret de ambiente
//           ou o fallback fixo no código).
//
// Auth: Bearer JWT + checagem is_super_admin() com client user-scoped.
//
// Diferente do recipient_id de uma LOJA (update-pagarme-recipient), aqui não
// existe checagem de "não pode ser igual ao da plataforma" — esse É o
// recipient da plataforma.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  PLATFORM_RECIPIENT_CHAVE,
  clearPlatformRecipientCache,
} from "../_shared/platformRecipient.ts";

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";
const RECIPIENT_ID_RE = /^re_[a-zA-Z0-9]+$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getPagarmeSecretKeyForCheck(): Promise<string | null> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await admin
    .from("plataforma_credenciais")
    .select("valor")
    .eq("chave", "PAGARME_SECRET_KEY")
    .maybeSingle();
  return data?.valor ?? Deno.env.get("PAGARME_SECRET_KEY") ?? Deno.env.get("STRIPE_TEST_API_KEY") ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: isSuper, error: superErr } = await userClient.rpc("is_super_admin");
    if (superErr || isSuper !== true) {
      return json({ error: "Apenas super administradores podem gerenciar o recipient da plataforma." }, 403);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const envValue = (Deno.env.get("PAGARME_PLATFORM_RECIPIENT_ID") ?? "").trim() || null;
    const FALLBACK = "re_cmsov7qej003a0l9thvhq2gfi";

    if (req.method === "GET") {
      const { data: row } = await admin
        .from("plataforma_credenciais")
        .select("valor, updated_at")
        .eq("chave", PLATFORM_RECIPIENT_CHAVE)
        .maybeSingle();

      const efetivo = row?.valor ?? envValue ?? FALLBACK;
      const origem = row?.valor ? "banco" : envValue ? "ambiente" : "fallback";

      let valida: boolean | null = null;
      let nome: string | null = null;
      let statusRecipient: string | null = null;
      let diagnostico: string | null = null;

      const secretKey = await getPagarmeSecretKeyForCheck();
      if (secretKey && efetivo) {
        const check = await fetch(`${PAGARME_BASE_URL}/recipients/${efetivo}`, {
          headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
        });
        const data = await check.json().catch(() => null);
        valida = check.ok;
        if (check.ok) {
          nome = data?.name ?? data?.default_bank_account?.holder_name ?? null;
          statusRecipient = data?.status ?? null;
        } else {
          diagnostico = data?.message ?? `Provedor respondeu status ${check.status}.`;
        }
      }

      return json({
        configurado: !!efetivo,
        recipient_id: efetivo,
        origem,
        valida,
        nome,
        status_recipient: statusRecipient,
        diagnostico,
        atualizado_em: row?.updated_at ?? null,
      });
    }

    if (req.method === "DELETE") {
      await admin.from("plataforma_credenciais").delete().eq("chave", PLATFORM_RECIPIENT_CHAVE);
      clearPlatformRecipientCache();
      return json({ ok: true });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => null);
    const raw: unknown = body?.recipient_id;
    if (typeof raw !== "string") return json({ error: "recipient_id é obrigatório" }, 400);
    const recipientId = raw.trim();
    if (!RECIPIENT_ID_RE.test(recipientId)) {
      return json({ error: "Formato inválido. Esperado: re_xxxxxxxxxxxxxxxx" }, 400);
    }

    const secretKey = await getPagarmeSecretKeyForCheck();
    if (!secretKey) {
      return json({ error: "Chave do provedor de pagamentos não configurada. Configure-a primeiro." }, 500);
    }

    // Valida direto no Pagar.me antes de salvar — evita gravar um recipient
    // inexistente/inativo que só quebraria no primeiro split da próxima venda.
    const res = await fetch(`${PAGARME_BASE_URL}/recipients/${recipientId}`, {
      headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return json(
        { error: `Recipient não encontrado no Pagar.me: ${data?.message ?? res.statusText}` },
        422,
      );
    }
    const nome = data?.name ?? data?.default_bank_account?.holder_name ?? null;
    const statusRecipient = data?.status ?? null;
    if (statusRecipient && statusRecipient !== "active") {
      return json(
        {
          error: `Este recipient existe no Pagar.me, mas está com status "${statusRecipient}" (não "active"). Confirme antes de vincular.`,
          nome,
          status_recipient: statusRecipient,
        },
        422,
      );
    }

    const { error: upErr } = await admin.from("plataforma_credenciais").upsert(
      {
        chave: PLATFORM_RECIPIENT_CHAVE,
        valor: recipientId,
        last4: recipientId.slice(-4),
        updated_by: userData.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chave" },
    );
    if (upErr) {
      console.error("Erro ao salvar recipient da plataforma:", upErr.message);
      return json({ error: upErr.message }, 500);
    }

    clearPlatformRecipientCache();

    return json({ ok: true, recipient_id: recipientId, nome, status_recipient: statusRecipient });
  } catch (err) {
    console.error("Erro em platform-recipient:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});
