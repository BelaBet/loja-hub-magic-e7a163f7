// Resolve a chave secreta do provedor de pagamentos.
//
// Ordem de precedência:
// 1) Secret de ambiente PAGARME_SECRET_KEY (configurada pela plataforma);
// 2) Tabela public.plataforma_credenciais (salva pelo super admin na tela de
//    Configurações). A tabela não é acessível por nenhum client — só o
//    service_role lê o valor aqui dentro.
import { createClient } from "npm:@supabase/supabase-js@2";

export const PAGARME_SECRET_CHAVE = "PAGARME_SECRET_KEY";

let cached: { value: string; at: number } | null = null;
const TTL_MS = 30_000;

export async function getPagarmeSecretKey(): Promise<string | null> {
  const fromEnv = Deno.env.get("PAGARME_SECRET_KEY");
  if (fromEnv) return fromEnv;

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
  if (error || !data?.valor) return null;

  cached = { value: data.valor, at: Date.now() };
  return data.valor;
}
