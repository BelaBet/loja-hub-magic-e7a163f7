// Validação central do recipient da plataforma.
// Todo fluxo de pagamento DEVE resolver o recipient por aqui.

export const EXPECTED_PLATFORM_RECIPIENT_ID = "re_cmsov4l64001u0l9t1dkhy8gw";

const RECIPIENT_FORMAT = /^re_[a-z0-9]{20,}$/i;

export class PlatformRecipientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformRecipientError";
  }
}

/**
 * Retorna o recipient da plataforma, garantindo que:
 *  - o secret está configurado;
 *  - tem formato válido (re_...);
 *  - é exatamente o recipient vigente da plataforma.
 */
export function getPlatformRecipientId(): string {
  const value = (Deno.env.get("PAGARME_PLATFORM_RECIPIENT_ID") ?? "").trim();

  if (!value) {
    throw new PlatformRecipientError("PAGARME_PLATFORM_RECIPIENT_ID não configurada");
  }
  if (!RECIPIENT_FORMAT.test(value)) {
    throw new PlatformRecipientError("PAGARME_PLATFORM_RECIPIENT_ID com formato inválido");
  }
  if (value !== EXPECTED_PLATFORM_RECIPIENT_ID) {
    console.error(
      `[platform-recipient] mismatch: esperado ${EXPECTED_PLATFORM_RECIPIENT_ID}, recebido ${value}`,
    );
    throw new PlatformRecipientError(
      "PAGARME_PLATFORM_RECIPIENT_ID desatualizada — atualize o secret da plataforma",
    );
  }
  return value;
}

/** true quando o recipient informado é o próprio recipient da plataforma. */
export function isPlatformRecipient(recipientId: string): boolean {
  return recipientId.trim() === EXPECTED_PLATFORM_RECIPIENT_ID;
}

/** Valida o recipient do vendedor (não pode ser igual ao da plataforma). */
export function assertSellerRecipientId(sellerRecipientId: string): void {
  if (!RECIPIENT_FORMAT.test(sellerRecipientId)) {
    throw new PlatformRecipientError("recipient do lojista com formato inválido");
  }
  if (sellerRecipientId === EXPECTED_PLATFORM_RECIPIENT_ID) {
    throw new PlatformRecipientError(
      "recipient do lojista não pode ser igual ao da plataforma",
    );
  }
}
