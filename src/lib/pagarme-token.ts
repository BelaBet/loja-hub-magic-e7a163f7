type CardInput = {
  number: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  cvv: string;
};

const PAGARME_TOKENS_URL = "https://api.pagar.me/core/v5/tokens";

/**
 * Sends card data directly from the browser to Pagar.me and returns a
 * short-lived card token. Raw card data never reaches our Supabase functions.
 * Requires VITE_PAGARME_PUBLIC_KEY to be configured and the checkout domain
 * to be authorized in the Pagar.me dashboard.
 */
export async function tokenizePagarmeCard(card: CardInput): Promise<string> {
  const publicKey = import.meta.env.VITE_PAGARME_PUBLIC_KEY as string | undefined;
  if (!publicKey) {
    throw new Error("Pagamento com cartão indisponível: a chave pública do Pagar.me não está configurada.");
  }

  const response = await fetch(`${PAGARME_TOKENS_URL}?appId=${encodeURIComponent(publicKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "card",
      card: {
        number: card.number.replace(/\s/g, ""),
        holder_name: card.holder_name.trim(),
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        cvv: card.cvv,
      },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    throw new Error(data?.message ?? "Não foi possível validar o cartão com o Pagar.me.");
  }
  return String(data.id);
}
