## Visão geral

Sistema novo de Recibos Digitais paralelo às vendas existentes (não altera `vendas`/`venda_itens`/`Recibo.tsx` antigos). Adiciona menu lateral "Recibos" com 4 rotas, link público mobile-first, e templates personalizáveis (Padrão, Minimalista, Dark Premium).

## Banco de dados (migration)

**`public.recibos`** — recibos digitais por loja
- `loja_id`, `numero_seq` (int), `ano` (int), `numero_formatado` (`REC-{ANO}-{00000}`, gerado por trigger)
- `cliente_nome`, `cliente_whatsapp`, `cliente_email`, `cliente_cpf`
- `itens` (jsonb: `[{produto, qtd, preco_unit, total}]`)
- `subtotal`, `desconto`, `total` (numeric)
- `forma_pagamento` (`dinheiro|pix|credito|debito|boleto`), `valor_recebido`, `troco`
- `observacao`, `status` (`pago|pendente|cancelado`), `motivo_cancelamento`, `cancelado_em`
- `enviado_whatsapp_em`, `enviado_email_em`, `visualizado_em`, `visualizacoes` (int)
- `created_by` (uuid), timestamps
- Trigger BEFORE INSERT: calcula `ano = EXTRACT(YEAR FROM now())`, `numero_seq = COALESCE(MAX(numero_seq) FILTER (WHERE ano = current_ano AND loja_id = NEW.loja_id), 0) + 1`, monta `numero_formatado`
- Unique `(loja_id, ano, numero_seq)`
- RLS: loja_member tudo; `anon SELECT` apenas linha específica por id (para página pública)
- GRANTS para `authenticated`, `anon` (SELECT), `service_role`

**`public.recibos_config`** — 1 linha por loja (upsert)
- `loja_id` (PK), `template_ativo` (`padrao|minimalista|dark`)
- `loja_nome_exibicao`, `loja_cnpj`, `loja_endereco`, `loja_telefone`, `loja_logo_url`
- `mensagem_rodape`, `template_whatsapp` (texto com `{nome} {numero} {total} {forma} {link}`)
- toggles bool: `mostrar_logo`, `mostrar_endereco`, `mostrar_cnpj`, `mostrar_cpf_cliente`, `mostrar_troco`, `envio_automatico_whatsapp`
- RLS: loja_member full; `anon SELECT` (necessário para renderizar página pública com identidade da loja) — apenas via join no recibo
- Defaults razoáveis

**RPC `incrementar_visualizacao_recibo(p_id uuid)`** — SECURITY DEFINER, anon-callable, set `visualizado_em = COALESCE(visualizado_em, now())`, `visualizacoes = visualizacoes + 1`.

## Frontend

**Rotas novas em `App.tsx`:**
- `/dashboard/recibos` → `RecibosLista.tsx`
- `/dashboard/recibos/novo` → `RecibosNovo.tsx`
- `/dashboard/recibos/templates` → `RecibosTemplates.tsx`
- `/dashboard/recibos/:id` → `RecibosPreview.tsx` (autenticado)
- `/recibo/:id` → `ReciboPublico.tsx` (público, sem auth)

Todas as telas autenticadas envoltas em `<AppLayout>`.

**Item de menu** em `AppSidebar.tsx`: "Recibos" (ícone `Receipt`), apontando para `/dashboard/recibos`. Submenu simples via colapsável shadcn (Emitir / Todos / Templates).

**Componentes compartilhados em `src/components/recibos/`:**
- `ReciboPaper.tsx` — render do papel do recibo (recebe `recibo`, `config`, `template`); 3 variantes via classes Tailwind
- `TemplateSeletor.tsx` — 3 cards/botões de template
- `MetricaCard.tsx` — KPI card
- `ItemRow.tsx` — linha editável da tabela de itens
- `PagamentoChips.tsx` — chips pill de forma de pagamento
- `StatusBadge.tsx`
- `whatsappMessage.ts` — substitui variáveis e abre `wa.me/{numero}?text=`
- `masks.ts` — máscaras BR (whatsapp, cpf), `maskCpfDisplay`

**Hooks TanStack Query em `src/hooks/recibos/`:**
- `useRecibos(filtros)`, `useRecibo(id)`, `useReciboPublico(id)`
- `useReciboConfig()` (loja ativa), `useUpdateReciboConfig()`
- `useCreateRecibo()`, `useCancelarRecibo()`, `useRegistrarEnvio()` (marca enviado_whatsapp_em/email_em)

**Tela 1 — Emitir (`RecibosNovo.tsx`):**
- Seções na ordem do spec, totais reativos via `useMemo`
- Cliente: inputs com máscaras
- Itens: tabela com `+ Adicionar item`, inputs inline, total da linha calculado
- Pagamento: `PagamentoChips`, campo desconto, valor recebido, troco automático só p/ dinheiro
- Caixa de totais sticky
- 3 botões: emitir+WhatsApp / emitir+imprimir (abre `/dashboard/recibos/:id?print=1`) / emitir+PDF (mesmo, usa `window.print`)

**Tela 2 — Listagem (`RecibosLista.tsx`):**
- 4 cards métricas (queries agregadas client-side ou via 1 query do mês + cálculos)
- Filtros (busca, status, período)
- Tabela com linhas clicáveis → preview
- Menu `···` por linha com ações (cancelar abre `AlertDialog` pedindo motivo)

**Tela 3 — Preview (`RecibosPreview.tsx`):**
- Layout 2 colunas (~160px + flex)
- Esquerda: `TemplateSeletor` (estado local, persiste opcionalmente), botões Enviar (WhatsApp/Email/Copiar link)
- Direita: `<ReciboPaper>` com `templateSelecionado`
- Banner vermelho se cancelado
- Top: Imprimir / PDF (`window.print`)
- Suporta `?print=1` para auto-print

**Tela 4 — Templates (`RecibosTemplates.tsx`):**
- Grid 3 cards de template com miniatura `ReciboPaper` em scale-50
- Seção Loja: inputs
- Seção Exibição: toggles via `Switch`
- Seção WhatsApp: `Textarea` + lista de variáveis disponíveis
- Botão "Salvar" fixo no topo (sticky)

**Página pública (`ReciboPublico.tsx`):**
- Sem `AppLayout`, sem auth
- Busca recibo + config via `anon` (RLS permite SELECT por id)
- Chama RPC `incrementar_visualizacao_recibo` no mount
- Renderiza `<ReciboPaper>` mobile-first
- Botões: Baixar PDF (`window.print`), Compartilhar (`navigator.share` ou fallback copy)
- Banner cancelado

## Regras de negócio aplicadas
- Numeração: gerada por trigger no banco (atômica, reinicia por ano, isolada por loja)
- CPF: máscara display sempre `***.***.***-XX` (só últimos 2 dígitos)
- Troco: condicional `forma === 'dinheiro' && valor_recebido > total`
- Cancelamento: motivo obrigatório, status muda mas linha permanece
- WhatsApp: monta texto via template configurável → `wa.me/{55+ddd+numero}?text={encodeURIComponent}`
- PDF/Imprimir: CSS `@page` + visibility classes copiando padrão do `Recibo.tsx` atual

## Ordem de implementação
1. Migration (recibos + recibos_config + trigger numeração + RPC visualização + GRANTs + RLS)
2. Tipos e hooks compartilhados (`ReciboPaper`, masks, whatsapp helper, hooks TanStack)
3. Tela 1 (Emitir) + rota
4. Tela 3 (Preview) + rota + página pública
5. Tela 2 (Listagem) + rota
6. Tela 4 (Templates) + rota
7. Menu lateral atualizado

## Notas
- Não toca `vendas`, `Recibo.tsx`, ou rota `/vendas/:id/recibo` existente
- `recibos_config` permite `anon SELECT` somente da linha referenciada por recibo público (escopo já garantido pelo recibo carregar primeiro)
- Itens armazenados em jsonb (não dependem da tabela `produtos`) — recibo é snapshot do que foi vendido