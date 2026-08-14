// Edge function: cria pedido (PIX, crédito ou débito) com split.
// Secrets: PAGARME_SECRET_KEY, PAGARME_PLATFORM_RECIPIENT_ID.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assertSellerRecipientId,
  getPlatformRecipientId,
  isPlatformRecipient,
  PlatformRecipientError,
} from "../_shared/platformRecipient.ts";
import { getPagarmeSecretKey } from "../_shared/pagarmeSecret.ts";
const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_BASE_RATE = 0.0096;
const INSTALLMENT_RATE = 0.011;
const STONE_MDR_RATE = 0.0204;
const BASE_FEE_RATE = PLATFORM_BASE_RATE + STONE_MDR_RATE;

function calculateSplit(baseAmount: number, installments: number, passToCustomer: boolean) {
  const safeInstallments = Math.min(12, Math.max(1, Math.trunc(installments || 1)));
  const installmentRate = safeInstallments > 1 ? INSTALLMENT_RATE * (safeInstallments - 1) : 0;
  const platformRate = PLATFORM_BASE_RATE + installmentRate;
  const baseFee = passToCustomer ? Math.round(baseAmount * BASE_FEE_RATE) : 0;
  const installmentSurcharge = passToCustomer && safeInstallments > 1
    ? Math.round(baseAmount * installmentRate)
    : 0;
  const totalAmount = baseAmount + baseFee + installmentSurcharge;
  const platformAmount = Math.round(totalAmount * platformRate);
  const sellerAmount = totalAmount - platformAmount;
  return { totalAmount, platformAmount, sellerAmount, safeInstallments };
}

function buildSplit(platformAmount: number, sellerAmount: number, platformRecipientId: string, sellerRecipientId: string) {
  return [
    {
      recipient_id: platformRecipientId,
      amount: platformAmount,
      type: "flat",
      options: { charge_processing_fee: false, liable: false, charge_remainder_fee: false },
    },
    {
      recipient_id: sellerRecipientId,
      amount: sellerAmount,
      type: "flat",
      options: { charge_processing_fee: true, liable: true, charge_remainder_fee: true },
    },
  ];
}

type CardData = {
  number: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  cvv: string;
  installments?: number;
  statement_descriptor?: string;
};

type Body = {
  payment_method: "pix" | "credit_card" | "debit_card";
  amount: number;
  venda_id?: string;
  customer?: {
    name?: string;
    email?: string;
    type?: "individual" | "company";
    document?: string;
    area_code?: string;
    phone?: string;
  };
  items?: Array<{ amount: number; description: string; quantity: number; code?: string }>;
  card?: CardData;
  pass_surcharge_to_customer?: boolean;
};

function luhnValid(value: string) {
  let sum = 0;
  let doubleDigit = false;
  for (let i = value.length - 1; i >= 0; i--) {
    let digit = Number(value[i]);
    if (!Number.isInteger(digit)) return false;
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return value.length >= 13 && value.length <= 19 && sum % 10 === 0;
}

function validateCard(card: CardData | undefined, installments: number) {
  if (!card) return "Dados do cartão obrigatórios";
  const number = String(card.number ?? "").replace(/\s/g, "");
  if (!luhnValid(number)) return "Número do cartão inválido";
  if (!String(card.holder_name ?? "").trim()) return "Nome do cartão obrigatório";
  if (!Number.isInteger(card.exp_month) || card.exp_month < 1 || card.exp_month > 12) return "Mês de validade inválido";
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const currentYear = now.getUTCFullYear();
  if (!Number.isInteger(card.exp_year) || card.exp_year < currentYear || (card.exp_year === currentYear && card.exp_month < currentMonth)) {
    return "Cartão expirado";
  }
  if (!/^\d{3,4}$/.test(String(card.cvv ?? ""))) return "CVV inválido";
  if (!Number.isInteger(installments) || installments < 1 || installments > 12) return "Número de parcelas inválido";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const secretKey = await getPagarmeSecretKey();
    if (!secretKey) return json({ error: "Chave do provedor de pagamentos não configurada. Um super administrador pode salvá-la em Configurações." }, 500);

    let platformRecipientId: string;
    try {
      platformRecipientId = await getPlatformRecipientId();
    } catch (e) {
      if (e instanceof PlatformRecipientError) return json({ error: e.message }, 500);
      throw e;
    }

    const body = (await req.json()) as Body;
    const {
      payment_method,
      amount,
      customer,
      items,
      card,
      venda_id,
      pass_surcharge_to_customer = true,
    } = body;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const appMeta = (claimsData.claims as { app_metadata?: { active_loja_id?: string } }).app_metadata;
    let lojaId = appMeta?.active_loja_id ?? null;
    if (!lojaId) {
      const userId = claimsData.claims.sub as string;
      const { data: lu } = await admin
        .from("loja_usuarios")
        .select("loja_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      lojaId = lu?.loja_id ?? null;
    }

    let seller_recipient_id: string | null = null;
    if (lojaId) {
      const { data: loja } = await admin
        .from("lojas")
        .select("pagarme_recipient_id")
        .eq("id", lojaId)
        .maybeSingle();
      seller_recipient_id = loja?.pagarme_recipient_id ?? null;
    }
    if (seller_recipient_id && (await isPlatformRecipient(seller_recipient_id))) seller_recipient_id = null;
    if (seller_recipient_id) {
      try {
        await assertSellerRecipientId(seller_recipient_id);
      } catch (e) {
        if (e instanceof PlatformRecipientError) return json({ error: e.message }, 400);
        throw e;
      }
    }

    if (!["pix", "credit_card", "debit_card"].includes(payment_method)) {
      return json({ error: "payment_method inválido (pix, credit_card ou debit_card)" }, 400);
    }
    if (!Number.isInteger(amount) || amount <= 0) return json({ error: "amount obrigatório (em centavos)" }, 400);

    const installments = card?.installments ?? 1;
    if (payment_method !== "credit_card" && installments !== 1) return json({ error: "Parcelamento disponível apenas no crédito" }, 400);
    if (payment_method === "credit_card" || payment_method === "debit_card") {
      const cardError = validateCard(card, installments);
      if (cardError) return json({ error: cardError }, 400);
    }

    // If a sale id is supplied, it must belong to the authenticated user's active store.
    if (venda_id) {
      if (!lojaId) return json({ error: "Loja ativa não encontrada" }, 400);
      const { data: venda, error: vendaError } = await admin
        .from("vendas")
        .select("id")
        .eq("id", venda_id)
        .eq("loja_id", lojaId)
        .maybeSingle();
      if (vendaError || !venda) return json({ error: "Venda não encontrada para a loja ativa" }, 404);
    }

    const { totalAmount, platformAmount, sellerAmount, safeInstallments } = calculateSplit(
      amount,
      payment_method === "credit_card" ? installments : 1,
      pass_surcharge_to_customer,
    );

    const splitConfig = seller_recipient_id && platformRecipientId
      ? buildSplit(platformAmount, sellerAmount, platformRecipientId, seller_recipient_id)
      : null;

    const orderPayload: Record<string, unknown> = {
      items: items ?? [{ amount: totalAmount, description: "Venda PDV", quantity: 1, code: "PDV-001" }],
      customer: {
        name: customer?.name ?? "Cliente",
        email: customer?.email ?? "cliente@email.com",
        type: customer?.type ?? "individual",
        document: (customer?.document ?? "00000000000").replace(/\D/g, ""),
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: customer?.area_code ?? "11",
            number: (customer?.phone ?? "999999999").replace(/\D/g, ""),
          },
        },
      },
      payments: [] as unknown[],
    };

    if (payment_method === "pix") {
      const payment: Record<string, unknown> = { payment_method: "pix", pix: { expires_in: 3600 }, amount: totalAmount };
      if (splitConfig) payment.split = splitConfig;
      (orderPayload.payments as unknown[]).push(payment);
    } else if (payment_method === "credit_card") {
      const payment: Record<string, unknown> = {
        payment_method: "credit_card",
        credit_card: {
          installments: safeInstallments,
          statement_descriptor: card!.statement_descriptor ?? "PDV",
          card: {
            number: card!.number.replace(/\s/g, ""),
            holder_name: card!.holder_name.trim(),
            exp_month: card!.exp_month,
            exp_year: card!.exp_year,
            cvv: card!.cvv,
          },
        },
        amount: totalAmount,
      };
      if (splitConfig) payment.split = splitConfig;
      (orderPayload.payments as unknown[]).push(payment);
    } else {
      const payment: Record<string, unknown> = {
        payment_method: "debit_card",
        debit_card: {
          card: {
            number: card!.number.replace(/\s/g, ""),
            holder_name: card!.holder_name.trim(),
            exp_month: card!.exp_month,
            exp_year: card!.exp_year,
            cvv: card!.cvv,
          },
        },
        amount: totalAmount,
      };
      if (splitConfig) payment.split = splitConfig;
      (orderPayload.payments as unknown[]).push(payment);
    }

    const pagarmeRes = await fetch(`${PAGARME_BASE_URL}/orders`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(secretKey + ":")}`, "Content-Type": "application/json" },
      body: JSON.stringify(orderPayload),
    });
    const pagarmeData = await pagarmeRes.json();
    if (!pagarmeRes.ok) {
      console.error("Erro Pagar.me:", pagarmeData);
      return json({ error: pagarmeData?.message ?? "Erro ao criar pedido", details: pagarmeData }, pagarmeRes.status);
    }

    const charge = pagarmeData.charges?.[0];
    const lastTransaction = charge?.last_transaction;

    if (venda_id && lojaId) {
      const { error: linkError } = await admin
        .from("vendas")
        .update({
          pagarme_order_id: pagarmeData.id,
          pagarme_charge_id: charge?.id ?? null,
          pagamento_status: charge?.status === "paid" || pagarmeData.status === "paid" ? "pago" : "pendente",
          status: charge?.status === "paid" || pagarmeData.status === "paid" ? "concluida" : "pendente",
          updated_at: new Date().toISOString(),
        })
        .eq("id", venda_id)
        .eq("loja_id", lojaId);
      if (linkError) console.error("Falha ao vincular pedido à venda:", linkError);
    }

    return json({
      order_id: pagarmeData.id,
      status: pagarmeData.status,
      charge_status: charge?.status ?? null,
      amount: totalAmount,
      base_amount: amount,
      platform_amount: platformAmount,
      seller_amount: sellerAmount,
      split_applied: !!splitConfig,
      pix_qr_code: lastTransaction?.qr_code ?? null,
      pix_qr_code_url: lastTransaction?.qr_code_url ?? null,
      pix_expires_at: lastTransaction?.expires_at ?? null,
      card_status: lastTransaction?.status ?? null,
      card_brand: lastTransaction?.card?.brand ?? null,
    });
  } catch (err) {
    console.error("Erro interno create-order:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
