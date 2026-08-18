// Gestão do token Focus NFe de UMA loja (diferente de plataforma_credenciais,
// que é global) — cada loja emite notas em nome do seu próprio CNPJ.
//
// GET    -> status: configurado ou não, últimos 4 dígitos, se o token é válido
//           (testado contra o Focus NFe).
// POST   -> { focus_nfe_token, ambiente: 'homologacao'|'producao' } valida
//           direto no Focus NFe antes de salvar.
// DELETE -> remove o token salvo.
//
// Auth: Bearer JWT de funcionário com papel admin/gerente na loja ativa
// (mesmo padrão de acesso das outras configurações da loja).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function focusBaseUrl(ambiente: string) {
  return ambiente === "producao" ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";
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

    const { data: lojaId } = await userClient.rpc("get_loja_id");
    if (!lojaId) return json({ error: "Loja ativa não encontrada" }, 400);

    const { data: isAdmin } = await userClient.rpc("has_loja_role", { _role: "admin" });
    const { data: isGerente } = await userClient.rpc("has_loja_role", { _role: "gerente" });
    if (!isAdmin && !isGerente) {
      return json({ error: "Apenas administradores ou gerentes podem gerenciar a configuração fiscal." }, 403);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: lojaFiscal } = await admin
      .from("lojas")
      .select("config_fiscal")
      .eq("id", lojaId)
      .maybeSingle();
    const ambiente: string = (lojaFiscal?.config_fiscal as any)?.ambiente ?? "homologacao";

    if (req.method === "GET") {
      const { data: row } = await admin
        .from("loja_credenciais_fiscais")
        .select("last4, updated_at")
        .eq("loja_id", lojaId)
        .maybeSingle();

      let valido: boolean | null = null;
      if (row) {
        // Token existe mas não é reexposto — pra testar de fato precisaríamos
        // do valor completo, que não guardamos em lugar acessível aqui além
        // do próprio banco (service_role). Buscamos direto pra validar.
        const { data: full } = await admin
          .from("loja_credenciais_fiscais")
          .select("focus_nfe_token")
          .eq("loja_id", lojaId)
          .maybeSingle();
        if (full?.focus_nfe_token) {
          const check = await fetch(`${focusBaseUrl(ambiente)}/empresas`, {
            headers: { Authorization: `Basic ${btoa(full.focus_nfe_token + ":")}` },
          });
          valido = check.ok;
        }
      }

      return json({ configurado: !!row, last4: row?.last4 ?? null, ambiente, valido, atualizado_em: row?.updated_at ?? null });
    }

    if (req.method === "DELETE") {
      await admin.from("loja_credenciais_fiscais").delete().eq("loja_id", lojaId);
      return json({ ok: true });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.json().catch(() => null);
    const token: string | undefined = body?.focus_nfe_token;
    if (!token || token.trim().length < 8) return json({ error: "Token inválido" }, 400);
    const trimmed = token.trim();

    // Valida direto no Focus NFe antes de salvar — GET /empresas só exige
    // autenticação válida, não depende de nenhuma empresa já cadastrada.
    const check = await fetch(`${focusBaseUrl(ambiente)}/empresas`, {
      headers: { Authorization: `Basic ${btoa(trimmed + ":")}` },
    });
    if (!check.ok) {
      const errBody = await check.json().catch(() => null);
      return json({ error: `Token recusado pelo Focus NFe (ambiente ${ambiente}): ${errBody?.mensagem ?? check.statusText}` }, 422);
    }

    const { error: upErr } = await admin.from("loja_credenciais_fiscais").upsert(
      {
        loja_id: lojaId,
        focus_nfe_token: trimmed,
        last4: trimmed.slice(-4),
        updated_by: userData.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "loja_id" },
    );
    if (upErr) {
      console.error("Erro ao salvar credencial fiscal:", upErr.message);
      return json({ error: upErr.message }, 500);
    }

    return json({ ok: true, last4: trimmed.slice(-4), ambiente });
  } catch (err) {
    console.error("Erro em loja-fiscal-credenciais:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});
