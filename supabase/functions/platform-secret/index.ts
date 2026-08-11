// Gestão da chave secreta do provedor de pagamentos pelo super admin.
//
// GET  -> status: se está configurada, origem (ambiente/banco), últimos dígitos.
// POST -> { secret_key } valida a chave direto no provedor e salva no banco.
// DELETE -> remove a chave salva no banco.
//
// Auth: Bearer JWT + checagem is_super_admin() com client user-scoped.
import { createClient } from "npm:@supabase/supabase-js@2";

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";
const CHAVE = "PAGARME_SECRET_KEY";

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
      return json({ error: "Apenas super administradores podem gerenciar esta chave." }, 403);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const envKey = Deno.env.get("PAGARME_SECRET_KEY");

    if (req.method === "GET") {
      const { data: row } = await admin
        .from("plataforma_credenciais")
        .select("last4, updated_at")
        .eq("chave", CHAVE)
        .maybeSingle();

      return json({
        configurada: !!(envKey || row),
        origem: envKey ? "ambiente" : row ? "banco" : null,
        last4: envKey ? envKey.slice(-4) : row?.last4 ?? null,
        atualizada_em: row?.updated_at ?? null,
      });
    }

    if (req.method === "DELETE") {
      await admin.from("plataforma_credenciais").delete().eq("chave", CHAVE);
      return json({ ok: true });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => null);
    const raw: unknown = body?.secret_key;
    if (typeof raw !== "string") return json({ error: "secret_key é obrigatória" }, 400);
    const secretKey = raw.trim();
    if (secretKey.length < 10 || secretKey.length > 300) {
      return json({ error: "Chave com tamanho inválido" }, 400);
    }

    // Valida a chave direto no provedor antes de salvar — evita gravar uma
    // chave errada (ex.: public key) que só quebraria na primeira cobrança.
    const res = await fetch(`${PAGARME_BASE_URL}/recipients?size=1`, {
      headers: { Authorization: `Basic ${btoa(secretKey + ":")}` },
    });
    if (res.status === 401 || res.status === 403) {
      await res.text();
      return json(
        { error: "Chave recusada pelo provedor de pagamentos. Confira se copiou a chave secreta (secret key) correta." },
        422,
      );
    }
    if (!res.ok) {
      const detail = await res.text();
      console.error("Falha ao validar chave:", res.status, detail);
      return json({ error: `Não foi possível validar a chave (status ${res.status}).` }, 422);
    }
    await res.text();

    const { error: upErr } = await admin.from("plataforma_credenciais").upsert(
      {
        chave: CHAVE,
        valor: secretKey,
        last4: secretKey.slice(-4),
        updated_by: userData.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chave" },
    );
    if (upErr) {
      console.error("Erro ao salvar chave:", upErr.message);
      return json({ error: upErr.message }, 500);
    }

    return json({ ok: true, last4: secretKey.slice(-4), origem: envKey ? "ambiente" : "banco" });
  } catch (err) {
    console.error("Erro em platform-secret:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});
