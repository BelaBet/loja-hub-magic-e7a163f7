import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const SYSTEM_PROMPT = `Você é um assistente especializado em cadastro de produtos para varejo brasileiro.
Dado um nome curto de produto (e, opcionalmente, marca/categoria), preencha de forma realista e em PORTUGUÊS DO BRASIL todos os campos solicitados.

Regras:
- "descricao": 1-2 frases comerciais, sem inventar especificações técnicas duvidosas.
- "categoria" e "marca": curtas, capitalizadas.
- "unidade_medida": uma de UN, PC, CX, KG, G, L, ML, M, M2, M3, PR, DZ.
- "ncm": código NCM brasileiro de 8 dígitos plausível para o tipo de produto, no formato "XXXX.XX.XX".
- "cfop": padrão "5102" (revenda para dentro do estado) — só use outro se claramente apropriado.
- "cst_icms": para Simples Nacional use "102"; pode usar "00" se tributação normal sem benefício.
- "aliquota_icms": número de 0 a 100 (ex.: 18). Use 0 se for Simples Nacional CSOSN 102.
- "cst_pis" e "cst_cofins": padrão "07" (operação isenta) — só altere se claramente apropriado.

Retorne SOMENTE chamando a ferramenta "preencher_produto" com TODOS os campos.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "Não autorizado." }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) return json({ error: "Não autorizado." }, 401);

    const body = await req.json().catch(() => ({}));
    const nome: string = (body?.nome ?? "").toString().trim();
    const hint: string = (body?.hint ?? "").toString().trim();
    if (nome.length < 2) {
      return json({ error: "Informe o nome do produto (mínimo 2 caracteres)." }, 400);
    }

    const AI_GATEWAY_KEY = Deno.env.get("AI_GATEWAY_KEY") ?? Deno.env.get("LOVABLE_API_KEY");
    if (!AI_GATEWAY_KEY) return json({ error: "AI gateway não configurado." }, 500);

    const userPrompt = `Produto: ${nome}${hint ? `\nContexto adicional: ${hint}` : ""}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tool_choice: { type: "function", function: { name: "preencher_produto" } },
        tools: [
          {
            type: "function",
            function: {
              name: "preencher_produto",
              description: "Preenche os campos de cadastro do produto.",
              parameters: {
                type: "object",
                additionalProperties: false,
                properties: {
                  descricao: { type: "string" },
                  categoria: { type: "string" },
                  marca: { type: "string" },
                  unidade_medida: {
                    type: "string",
                    enum: ["UN","PC","CX","KG","G","L","ML","M","M2","M3","PR","DZ"],
                  },
                  ncm: { type: "string" },
                  cfop: { type: "string" },
                  cst_icms: { type: "string" },
                  aliquota_icms: { type: "number" },
                  cst_pis: { type: "string" },
                  cst_cofins: { type: "string" },
                },
                required: [
                  "descricao","categoria","marca","unidade_medida",
                  "ncm","cfop","cst_icms","aliquota_icms","cst_pis","cst_cofins",
                ],
              },
            },
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Limite de uso atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos insuficientes na sua workspace AI." }, 402);
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return json({ error: "Falha ao consultar IA." }, 500);
    }

    const data = await aiRes.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const rawArgs = call?.function?.arguments;
    if (!rawArgs) {
      console.error("AI returned no tool_call:", JSON.stringify(data));
      return json({ error: "IA não retornou sugestão estruturada." }, 502);
    }
    let suggestion: Record<string, unknown>;
    try {
      suggestion = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
    } catch (e) {
      console.error("Failed to parse tool args:", rawArgs);
      return json({ error: "Resposta inválida da IA." }, 502);
    }

    return json({ suggestion });
  } catch (e) {
    console.error("ai-fill-produto error:", e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}