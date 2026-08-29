import { createClient } from "npm:@supabase/supabase-js@2";
import { assertSellerRecipientId, getPlatformRecipientId, isPlatformRecipient, PlatformRecipientError } from "../_shared/platformRecipient.ts";
import { getPagarmeSecretKey } from "../_shared/pagarmeSecret.ts";
const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const PLATFORM_BASE_RATE = 0.0096;
const INSTALLMENT_RATE = 0.011;
const STONE_MDR_RATE = 0.0204;
const BASE_FEE_RATE = PLATFORM_BASE_RATE + STONE_MDR_RATE;
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function calculateSplit(baseAmount: number, installments: number, passToCustomer: boolean) { const safeInstallments = Math.min(12, Math.max(1, Math.trunc(installments || 1))); const installmentRate = safeInstallments > 1 ? INSTALLMENT_RATE * (safeInstallments - 1) : 0; const platformRate = PLATFORM_BASE_RATE + installmentRate; const baseFee = passToCustomer ? Math.round(baseAmount * BASE_FEE_RATE) : 0; const installmentSurcharge = passToCustomer && safeInstallments > 1 ? Math.round(baseAmount * installmentRate) : 0; const totalAmount = baseAmount + baseFee + installmentSurcharge; const platformAmount = Math.round(totalAmount * platformRate); return { totalAmount, platformAmount, sellerAmount: totalAmount - platformAmount, safeInstallments }; }
type AddressData = { street: string; number: string; complement?: string; zip_code: string; neighborhood: string; city: string; state: string; country?: string };
type CustomerData = { name?: string; email?: string; document?: string; area_code?: string; phone?: string; address?: AddressData };
function normalizeAddress(address: AddressData | undefined) { if (!address) return null; const normalized = { street: String(address.street ?? "").trim(), number: String(address.number ?? "").trim(), complement: String(address.complement ?? "").trim(), zip_code: String(address.zip_code ?? "").replace(/\D/g, ""), neighborhood: String(address.neighborhood ?? "").trim(), city: String(address.city ?? "").trim(), state: String(address.state ?? "").trim().toUpperCase(), country: String(address.country ?? "BR").trim().toUpperCase() }; if (!normalized.street || !normalized.number || !normalized.zip_code || !normalized.neighborhood || !normalized.city || !normalized.state) return null; if (!/^\d{8}$/.test(normalized.zip_code) || !/^[A-Z]{2}$/.test(normalized.state)) return null; return normalized; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => null);
    const catalogId: string | undefined = body?.catalog_id;
    const paymentMethod: string | undefined = body?.payment_method;
    const rawItems: Array<{ produto_id?: string; quantidade?: number }> = Array.isArray(body?.items) ? body.items : [];
    const customer: CustomerData | undefined = body?.customer;
    const cardToken: string | undefined = typeof body?.card_token === "string" ? body.card_token.trim() : undefined;
    const installments = paymentMethod === "credit_card" ? Math.trunc(Number(body?.installments ?? 1)) : 1;

    if (!catalogId) return json({ error: "catalog_id é obrigatório" }, 400);
    if (!["pix", "credit_card", "debit_card"].includes(paymentMethod ?? "")) return json({ error: "payment_method inválido (pix, credit_card ou debit_card)" }, 400);
    if (rawItems.length === 0) return json({ error: "Carrinho vazio" }, 400);
    if ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && !cardToken) return json({ error: "Token do cartão é obrigatório" }, 400);
    if (!Number.isInteger(installments) || installments < 1 || installments > 12) return json({ error: "Número de parcelas inválido" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: loja } = await admin.from("lojas").select("id, nome, pagarme_recipient_id").eq("id", catalogId).maybeSingle();
    if (!loja) return json({ error: "Catálogo não encontrado" }, 404);

    const requestedQtyByProduct = new Map<string, number>();
    for (const raw of rawItems) {
      if (typeof raw.produto_id !== "string" || !raw.produto_id) return json({ error: "Carrinho inválido" }, 400);
      const parsedQty = Math.trunc(Number(raw.quantidade));
      if (!Number.isFinite(parsedQty) || parsedQty < 1) return json({ error: `Quantidade inválida para o produto ${raw.produto_id}.` }, 400);
      const next = (requestedQtyByProduct.get(raw.produto_id) ?? 0) + parsedQty;
      if (!Number.isSafeInteger(next)) return json({ error: "Quantidade do carrinho inválida." }, 400);
      requestedQtyByProduct.set(raw.produto_id, next);
    }

    const produtoIds = Array.from(requestedQtyByProduct.keys());
    const { data: produtos } = await admin.from("produtos").select("id, nome, preco_venda, ativo, estoque(quantidade)").eq("loja_id", catalogId).in("id", produtoIds);
    const produtoMap = new Map((produtos ?? []).map((p: any) => [p.id, p]));
    const itensValidados: Array<{ produto_id: string; nome: string; quantidade: number; preco_unit: number }> = [];
    for (const [produtoId, quantidade] of requestedQtyByProduct) {
      const produto = produtoMap.get(produtoId);
      if (!produto || !produto.ativo) return json({ error: `Produto indisponível no catálogo (${produtoId}).` }, 400);
      const estoqueDisponivel = Array.isArray(produto.estoque) ? produto.estoque.reduce((s: number, e: any) => s + (e.quantidade ?? 0), 0) : 0;
      if (quantidade > estoqueDisponivel) return json({ error: `Estoque insuficiente para "${produto.nome}" (disponível: ${estoqueDisponivel}).` }, 409);
      const preco = Number(produto.preco_venda);
      if (!Number.isFinite(preco) || preco < 0) return json({ error: `Preço inválido para "${produto.nome}".` }, 409);
      itensValidados.push({ produto_id: produto.id, nome: produto.nome, quantidade, preco_unit: preco });
    }
    const subtotalReais = itensValidados.reduce((s, i) => s + i.preco_unit * i.quantidade, 0);
    const baseAmountCentavos = Math.round(subtotalReais * 100);
    if (!Number.isSafeInteger(baseAmountCentavos) || baseAmountCentavos <= 0) return json({ error: "Total inválido" }, 400);

    const secretKey = await getPagarmeSecretKey();
    if (!secretKey) return json({ error: "Este catálogo ainda não está pronto para receber pagamentos. Tente novamente mais tarde." }, 503);
    let platformRecipientId: string;
    try { platformRecipientId = await getPlatformRecipientId(); } catch (e) { if (e instanceof PlatformRecipientError) return json({ error: "Este catálogo ainda não está pronto para receber pagamentos. Tente novamente mais tarde." }, 503); throw e; }
    let sellerRecipientId: string | null = loja.pagarme_recipient_id ?? null;
    if (sellerRecipientId && (await isPlatformRecipient(sellerRecipientId))) sellerRecipientId = null;
    if (sellerRecipientId) { try { await assertSellerRecipientId(sellerRecipientId); } catch { sellerRecipientId = null; } }
    if (!sellerRecipientId) return json({ error: "Este catálogo ainda não está pronto para receber pagamentos. Tente novamente mais tarde." }, 503);

    const address = normalizeAddress(customer?.address);
    if (!address) return json({ error: "Endereço é obrigatório: rua, número, CEP, bairro, cidade e UF." }, 400);
    if (!String(customer?.name ?? "").trim()) return json({ error: "Nome do comprador é obrigatório" }, 400);
    if (!String(customer?.phone ?? "").replace(/\D/g, "")) return json({ error: "Telefone é obrigatório" }, 400);

    const { totalAmount, platformAmount, sellerAmount, safeInstallments } = calculateSplit(baseAmountCentavos, installments, true);
    const splitConfig = [
      { recipient_id: platformRecipientId, amount: platformAmount, type: "flat", options: { charge_processing_fee: false, liable: false, charge_remainder_fee: false } },
      { recipient_id: sellerRecipientId, amount: sellerAmount, type: "flat", options: { charge_processing_fee: true, liable: true, charge_remainder_fee: true } },
    ];

    const { data: venda, error: vendaErr } = await admin.from("vendas").insert({ loja_id: catalogId, total: totalAmount / 100, forma_pagamento: paymentMethod, status: "pendente", pagamento_status: "pendente", payment_channel: "catalogo_publico" }).select("id").single();
    if (vendaErr || !venda) { console.error("Erro ao criar venda do catálogo:", vendaErr); return json({ error: "Não foi possível iniciar o pedido. Tente novamente." }, 500); }
    const itensRows = itensValidados.map((i) => ({ venda_id: venda.id, produto_id: i.produto_id, quantidade: i.quantidade, preco_unit: i.preco_unit, desconto: 0 }));
    const { error: itensErr } = await admin.from("venda_itens").insert(itensRows);
    if (itensErr) { await admin.from("vendas").delete().eq("id", venda.id); return json({ error: "Não foi possível registrar o pedido. O estoque pode ter mudado; tente novamente." }, 409); }

    const orderPayload: Record<string, unknown> = {
      closed: false,
      items: itensValidados.map((i) => ({ amount: Math.round(i.preco_unit * 100), description: i.nome.slice(0, 255), quantity: i.quantidade })),
      customer: { name: customer!.name!.trim(), email: customer?.email ?? "cliente@email.com", type: "individual", document: (customer?.document ?? "00000000000").replace(/\D/g, ""), phones: { mobile_phone: { country_code: "55", area_code: customer?.area_code ?? "11", number: (customer?.phone ?? "").replace(/\D/g, "") } }, address },
      payments: [] as unknown[],
    };
    const billingAddress = { line_1: `${address.number}, ${address.street}${address.complement ? `, ${address.complement}` : ""}, ${address.neighborhood}`, zip_code: address.zip_code, city: address.city, state: address.state, country: address.country };
    if (paymentMethod === "pix") {
      (orderPayload.payments as unknown[]).push({ payment_method: "pix", pix: { expires_in: 3600 }, amount: totalAmount, split: splitConfig });
    } else if (paymentMethod === "credit_card") {
      (orderPayload.payments as unknown[]).push({ payment_method: "credit_card", amount: totalAmount, credit_card: { operation_type: "auth_and_capture", installments: safeInstallments, statement_descriptor: loja.nome.slice(0, 13), card_token: cardToken, billing_address: billingAddress }, split: splitConfig });
    } else {
      (orderPayload.payments as unknown[]).push({ payment_method: "debit_card", amount: totalAmount, debit_card: { card_token: cardToken, billing_address: billingAddress }, split: splitConfig });
    }

    const pagarmeRes = await fetch(`${PAGARME_BASE_URL}/orders`, { method: "POST", headers: { Authorization: `Basic ${btoa(secretKey + ":")}`, "Content-Type": "application/json", "Idempotency-Key": `catalogo-${venda.id}` }, body: JSON.stringify(orderPayload) });
    const pagarmeData = await pagarmeRes.json().catch(() => null);
    if (!pagarmeRes.ok) { console.error("Erro Pagar.me (catálogo):", pagarmeData); await admin.from("vendas").update({ pagamento_status: "falhou", status: "cancelada", updated_at: new Date().toISOString() }).eq("id", venda.id); return json({ error: pagarmeData?.message ?? "Pagamento recusado. Confira os dados e tente novamente." }, 422); }

    const charge = pagarmeData.charges?.[0]; const lastTransaction = charge?.last_transaction; const paid = charge?.status === "paid" || pagarmeData.status === "paid";
    const update: Record<string, unknown> = { pagarme_order_id: pagarmeData.id, pagarme_charge_id: charge?.id ?? null, pagamento_status: paid ? "pago" : paymentMethod === "pix" ? "pendente" : "falhou", updated_at: new Date().toISOString() };
    if (paid) { update.status = "concluida"; update.paid_at = new Date().toISOString(); } else if (paymentMethod !== "pix") update.status = "cancelada";
    const { error: updateErr } = await admin.from("vendas").update(update).eq("id", venda.id); if (updateErr) console.error("Pagamento criado, mas falhou ao atualizar a venda:", updateErr);
    return json({ ok: true, venda_id: venda.id, order_id: pagarmeData.id, status: pagarmeData.status, charge_status: charge?.status ?? null, amount: totalAmount, pix_qr_code: lastTransaction?.qr_code ?? null, pix_qr_code_url: lastTransaction?.qr_code_url ?? null, pix_expires_at: lastTransaction?.expires_at ?? null, transaction_message: lastTransaction?.acquirer_message ?? lastTransaction?.gateway_response?.message ?? null });
  } catch (err) { console.error("Erro interno catalogo-checkout:", err); return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500); }
});