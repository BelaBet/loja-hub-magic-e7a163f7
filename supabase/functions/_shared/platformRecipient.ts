// Validação central do recipient da plataforma.
// Todo fluxo de pagamento DEVE resolver o recipient por aqui.
//
// Ordem de precedência (mesmo padrão de _shared/pagarmeSecret.ts):
// 1) Tabela public.plataforma_credenciais (salva e validada pelo super
//    admin na tela de Configurações → "Recipient da plataforma") — fonte
//    de verdade quando presente, porque é conferida no Pagar.me antes de
//    gravar;
// 2) Secret de ambiente PAGARME_PLATFORM_RECIPIENT_ID;
// 3) Valor de fallback fixo no código — só existe pra não quebrar em
//    ambientes que ainda não configuraram nenhum dos dois acima.

import { createClient } from "npm:@supabase/supabase-js@2";

export const PLATFORM_RECIPIENT_CHAVE = "PAGARME_PLATFORM_RECIPIENT_ID";

const FALLBACK_PLATFORM_RECIPIENT_ID = "re_cmsov4l64001u0l9t1dkhy8gw";

const RECIPIENT_FORMAT = /^re_[a-z0-9]{20,}$/i;

export class PlatformRecipientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformRecipientError";
  }
}

let cached: { value: string; at: number } | null = null;
const TTL_MS = 30_000;

function envFallback(): string | null {
  return (Deno.env.get("PAGARME_PLATFORM_RECIPIENT_ID") ?? "").trim() || null;
}

/**
 * Resolve o recipient_id vigente da plataforma, garantindo formato válido.
 */
export async function getPlatformRecipientId(): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await admin
    .from("plataforma_credenciais")
    .select("valor")
    .eq("chave", PLATFORM_RECIPIENT_CHAVE)
    .maybeSingle();

  const value = (data?.valor ?? envFallback() ?? FALLBACK_PLATFORM_RECIPIENT_ID).trim();

  if (!RECIPIENT_FORMAT.test(value)) {
    throw new PlatformRecipientError(
      "Recipient da plataforma com formato inválido — configure em Configurações → Recipient da plataforma.",
    );
  }

  cached = { value, at: Date.now() };
  return value;
}

/** Limpa o cache em memória — chamar sempre que o valor salvo mudar. */
export function clearPlatformRecipientCache(): void {
  cached = null;
}

/** true quando o recipient informado é o próprio recipient da plataforma. */
export async function isPlatformRecipient(recipientId: string): Promise<boolean> {
  const platformId = await getPlatformRecipientId();
  return recipientId.trim() === platformId;
}

/** Valida o recipient do vendedor (não pode ser igual ao da plataforma). */
export async function assertSellerRecipientId(sellerRecipientId: string): Promise<void> {
  if (!RECIPIENT_FORMAT.test(sellerRecipientId)) {
    throw new PlatformRecipientError("recipient do lojista com formato inválido");
  }
  const platformId = await getPlatformRecipientId();
  if (sellerRecipientId === platformId) {
    throw new PlatformRecipientError("recipient do lojista não pode ser igual ao da plataforma");
  }
}
