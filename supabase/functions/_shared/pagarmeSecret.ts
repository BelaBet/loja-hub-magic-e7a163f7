// Resolve a chave secreta do provedor de pagamentos.
//
// Ordem de precedência:
// 1) Tabela public.plataforma_credenciais (salva e validada pelo super admin
//    na tela de Configurações) — tem prioridade porque é validada no provedor
//    antes de gravar;
// 2) Secret de ambiente PAGARME_SECRET_KEY (configurada pela plataforma).
import { createClient } from "npm:@supabase/supabase-js@2";

export const PAGARME_SECRET_CHAVE = "PAGARME_SECRET_KEY";

let cached: { value: string; at: number } | null = null;
const TTL_MS = 30_000;

function envFallback(): string | null {
  // Alguns projetos tiveram a chave do provedor salva com outro nome de secret.
  return (
    Deno.env.get("PAGARME_SECRET_KEY") ??
    Deno.env.get("STRIPE_TEST_API_KEY") ??
    null
  );
}

export async function getPagarmeSecretKey(): Promise<string | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin
    .from("plataforma_credenciais")
    .select("valor")
    .eq("chave", PAGARME_SECRET_CHAVE)
    .maybeSingle();
  if (error || !data?.valor) {
    return envFallback();
  }

  cached = { value: data.valor, at: Date.now() };
  return data.valor;
}
