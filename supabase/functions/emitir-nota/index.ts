// Emite (ou reenvia) uma NFC-e/NFe via Focus NFe, a partir de uma venda.
//
// Body: { venda_id: string, tipo?: 'nfce' | 'nfe', retry_nota_id?: string }
// - Se retry_nota_id for informado, reusa a REF já existente (Focus NFe não
//   deixa reemitir com uma ref nova pra uma venda que já tentou antes com a
//   ref antiga se ela chegou a ser autorizada — reenviar com a MESMA ref é
//   o jeito de corrigir um erro de validação e tentar de novo).
// - Sem retry_nota_id, cria uma nota nova (ou reaproveita a 'pendente' que o
//   trigger já criou automaticamente ao concluir a venda).
//
// Antes de chamar o Focus NFe, valida que todo produto do carrinho tem os
// campos fiscais mínimos (NCM, CST/CSOSN do ICMS) — evita emitir com dado
// fiscal incompleto/inventado, que geraria nota errada ou rejeição confusa.
//
// Auth: Bearer JWT de funcionário com papel admin/gerente na loja da venda.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function focusBaseUrl(ambiente: string) {
  return ambiente === "producao" ? "https://api.focusnfe.com.br/v2" : "https://homologacao.focusnfe.com.br/v2";
}

// Códigos de forma de pagamento aceitos pela SEFAZ (tabela NFCe/NFe).
const FORMA_PAGAMENTO_CODIGO: Record<string, string> = {
  dinheiro: "01",
  cartao_credito: "03",
  cartao_debito: "04",
  pix: "17",
};

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

    const body = await req.json().catch(() => null);
    const vendaId: string | undefined = body?.venda_id;
    const tipoSolicitado: string = body?.tipo === "nfe" ? "nfe" : "nfce";
    const retryNotaId: string | undefined = body?.retry_nota_id;
    if (!vendaId) return json({ error: "venda_id é obrigatório" }, 400);

    const { data: isAdmin } = await userClient.rpc("has_loja_role", { _role: "admin" });
    const { data: isGerente } = await userClient.rpc("has_loja_role", { _role: "gerente" });
    if (!isAdmin && !isGerente) return json({ error: "Sem permissão para emitir notas fiscais." }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ─── 1. Carrega venda + loja (dono da venda, confirmado via RLS acima) ─
    const { data: venda } = await admin
      .from("vendas")
      .select("id, loja_id, total, forma_pagamento, cliente_id, cliente:clientes(nome, cpf_cnpj, email)")
      .eq("id", vendaId)
      .maybeSingle();
    if (!venda) return json({ error: "Venda não encontrada" }, 404);

    const { data: loja } = await admin
      .from("lojas")
      .select("id, cnpj, config_fiscal")
      .eq("id", venda.loja_id)
      .maybeSingle();
    if (!loja) return json({ error: "Loja não encontrada" }, 404);
    if (!loja.cnpj) return json({ error: "Cadastre o CNPJ da loja em Configurações antes de emitir notas." }, 422);

    const configFiscal = (loja.config_fiscal ?? {}) as Record<string, unknown>;
    const ambiente = (configFiscal.ambiente as string) === "producao" ? "producao" : "homologacao";

    const { data: cred } = await admin
      .from("loja_credenciais_fiscais")
      .select("focus_nfe_token")
      .eq("loja_id", loja.id)
      .maybeSingle();
    if (!cred?.focus_nfe_token) {
      return json({ error: "Configuração fiscal (token Focus NFe) ainda não cadastrada para esta loja." }, 422);
    }

    // ─── 2. Itens da venda + validação de campos fiscais obrigatórios ──────
    const { data: itens } = await admin
      .from("venda_itens")
      .select("quantidade, preco_unit, produto:produtos(id, nome, sku, ncm, cfop, unidade_medida, cst_icms, cst_pis, cst_cofins)")
      .eq("venda_id", vendaId);
    if (!itens || itens.length === 0) return json({ error: "Venda sem itens" }, 422);

    const faltando: string[] = [];
    for (const it of itens as any[]) {
      const p = it.produto;
      if (!p) continue;
      if (!p.ncm) faltando.push(`"${p.nome}" está sem NCM cadastrado`);
      if (!p.cst_icms) faltando.push(`"${p.nome}" está sem CST/CSOSN do ICMS cadastrado`);
    }
    if (faltando.length > 0) {
      return json({
        error: `Não é possível emitir: alguns produtos estão com dados fiscais incompletos. ${faltando.join("; ")}.`,
      }, 422);
    }

    // ─── 3. Determina/reaproveita a linha em notas_fiscais e a ref ─────────
    let notaId = retryNotaId;
    if (!notaId) {
      const { data: pendente } = await admin
        .from("notas_fiscais")
        .select("id")
        .eq("venda_id", vendaId)
        .eq("tipo", tipoSolicitado)
        .in("status", ["pendente", "rejeitada"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendente) {
        notaId = pendente.id;
      } else {
        const { data: nova, error: novaErr } = await admin
          .from("notas_fiscais")
          .insert({ loja_id: loja.id, venda_id: vendaId, tipo: tipoSolicitado, status: "processando" })
          .select("id")
          .single();
        if (novaErr || !nova) return json({ error: "Falha ao registrar nota fiscal" }, 500);
        notaId = nova.id;
      }
    }
    await admin.from("notas_fiscais").update({ status: "processando" }).eq("id", notaId);

    const ref = notaId.replace(/-/g, "");

    // ─── 4. Monta o payload e chama o Focus NFe ─────────────────────────────
    const itemsPayload = (itens as any[]).map((it, idx) => {
      const p = it.produto;
      const valorUnit = Number(it.preco_unit);
      const qtd = Number(it.quantidade);
      return {
        numero_item: String(idx + 1),
        codigo_produto: p?.sku || p?.id || `item-${idx + 1}`,
        descricao: p?.nome ?? "Produto",
        codigo_ncm: p.ncm,
        cfop: p?.cfop || "5102",
        quantidade_comercial: qtd,
        quantidade_tributavel: qtd,
        valor_unitario_comercial: valorUnit,
        valor_unitario_tributavel: valorUnit,
        valor_bruto: Math.round(valorUnit * qtd * 100) / 100,
        unidade_comercial: p?.unidade_medida || "UN",
        unidade_tributavel: p?.unidade_medida || "UN",
        icms_origem: "0",
        icms_situacao_tributaria: p.cst_icms,
        pis_situacao_tributaria: p?.cst_pis || "07",
        cofins_situacao_tributaria: p?.cst_cofins || "07",
      };
    });

    const formaPagamentoCodigo = FORMA_PAGAMENTO_CODIGO[venda.forma_pagamento] ?? "99";
    const formasPagamento = [{ forma_pagamento: formaPagamentoCodigo, valor_pagamento: Number(venda.total) }];

    const cliente = (venda as any).cliente as { nome?: string; cpf_cnpj?: string; email?: string } | null;
    const dataEmissao = new Date().toISOString();

    let focusPath: string;
    let payload: Record<string, unknown>;

    if (tipoSolicitado === "nfce") {
      focusPath = "nfce";
      payload = {
        cnpj_emitente: loja.cnpj.replace(/\D/g, ""),
        data_emissao: dataEmissao,
        presenca_comprador: "1",
        modalidade_frete: "9",
        local_destino: "1",
        natureza_operacao: "VENDA AO CONSUMIDOR",
        nome_destinatario: cliente?.nome || undefined,
        cpf_destinatario: cliente?.cpf_cnpj?.replace(/\D/g, "") || undefined,
        items: itemsPayload,
        formas_pagamento: formasPagamento,
      };
    } else {
      focusPath = "nfe";
      payload = {
        natureza_operacao: "Venda",
        data_emissao: dataEmissao,
        tipo_documento: 1,
        finalidade_emissao: 1,
        consumidor_final: 1,
        presenca_comprador: 1,
        local_destino: 1,
        cnpj_emitente: loja.cnpj.replace(/\D/g, ""),
        nome_destinatario: cliente?.nome || "CONSUMIDOR",
        cpf_destinatario: cliente?.cpf_cnpj?.replace(/\D/g, "") || undefined,
        valor_total: Number(venda.total),
        valor_produtos: Number(venda.total),
        modalidade_frete: 9,
        items: itemsPayload.map((i) => ({
          numero_item: Number(i.numero_item),
          codigo_produto: i.codigo_produto,
          descricao: i.descricao,
          cfop: i.cfop,
          quantidade_comercial: i.quantidade_comercial,
          valor_unitario_comercial: i.valor_unitario_comercial,
          valor_bruto: i.valor_bruto,
          codigo_ncm: i.codigo_ncm,
          unidade_comercial: i.unidade_comercial,
          unidade_tributavel: i.unidade_tributavel,
          quantidade_tributavel: i.quantidade_tributavel,
          valor_unitario_tributavel: i.valor_unitario_tributavel,
          inclui_no_total: 1,
          icms_origem: 0,
          icms_situacao_tributaria: i.icms_situacao_tributaria,
          pis_situacao_tributaria: i.pis_situacao_tributaria,
          cofins_situacao_tributaria: i.cofins_situacao_tributaria,
        })),
      };
    }

    const focusRes = await fetch(`${focusBaseUrl(ambiente)}/${focusPath}?ref=${ref}`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(cred.focus_nfe_token + ":")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const focusData = await focusRes.json().catch(() => null);

    // ─── 5. Atualiza a nota com o resultado ─────────────────────────────────
    if (focusData?.status === "autorizado") {
      await admin.from("notas_fiscais").update({
        status: "autorizada",
        numero: focusData.numero ? Number(focusData.numero) : null,
        serie: focusData.serie ?? null,
        chave_acesso: focusData.chave_nfe ?? null,
        protocolo: focusData.numero_protocolo ?? focusData.protocolo ?? null,
        danfe_url: focusData.caminho_danfe ? `${focusBaseUrl(ambiente)}${focusData.caminho_danfe}` : null,
        ref_focusnfe: ref,
        motivo_rejeicao: null,
        emitida_at: new Date().toISOString(),
      }).eq("id", notaId);
      return json({ ok: true, nota_id: notaId, status: "autorizada", chave_acesso: focusData.chave_nfe, danfe_url: focusData.caminho_danfe });
    }

    if (focusData?.status === "processando_autorizacao") {
      await admin.from("notas_fiscais").update({ status: "processando", ref_focusnfe: ref }).eq("id", notaId);
      return json({ ok: true, nota_id: notaId, status: "processando" });
    }

    // Rejeitada / erro de validação / erro do provedor
    const motivo = focusData?.mensagem_sefaz || focusData?.mensagem || focusData?.erros?.map((e: any) => e.mensagem).join("; ") || "Erro desconhecido do Focus NFe";
    await admin.from("notas_fiscais").update({ status: "rejeitada", motivo_rejeicao: motivo, ref_focusnfe: ref }).eq("id", notaId);
    return json({ error: motivo, nota_id: notaId }, 422);
  } catch (err) {
    console.error("Erro em emitir-nota:", err);
    return json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, 500);
  }
});
