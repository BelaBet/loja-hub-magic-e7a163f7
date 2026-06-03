
# Plano: Autonomia Multi-Tenant para Lojistas

Implementação em 3 prioridades. Cada bloco entra em uma rodada própria para validar incrementos.

---

## PRIORIDADE 1 — Loja ativa por usuário

### Banco
- Nova função `get_loja_id_v2()` SECURITY DEFINER:
  1. Lê `auth.jwt() -> 'app_metadata' ->> 'active_loja_id'`.
  2. Se válido (usuário pertence à loja via `loja_usuarios`), retorna.
  3. Fallback: primeira loja por `created_at ASC`.
- Migrar TODAS as RLS policies que usam `get_loja_id()` para `get_loja_id_v2()` (clientes, produtos, estoque, vendas, venda_itens, notas_fiscais, lojas, lojas_config_fiscal, maquininhas, movimentacoes_estoque).
- Manter `get_loja_id()` como wrapper de `get_loja_id_v2()` para não quebrar código existente.
- Nova edge function `set-active-loja` (verify_jwt=true):
  - Valida que `auth.uid()` pertence à `loja_id` recebida.
  - Usa service role para `auth.admin.updateUserById(uid, { app_metadata: { ...existing, active_loja_id } })`.
  - Retorna sucesso; cliente faz `supabase.auth.refreshSession()` para receber JWT atualizado.

### Frontend
- `src/contexts/LojaContext.tsx`: provider com `{ lojaAtiva, lojas, setLojaAtiva, loading }`.
  - No mount, query `loja_usuarios` join `lojas`.
  - `setLojaAtiva(id)`: invoca edge function, refresh session, atualiza state, persiste em `localStorage` (`active_loja_id`), invalida queries React Query.
- Wrapper `<LojaProvider>` em `App.tsx` envolvendo as rotas autenticadas.
- Componente `LojaSwitcher` na topbar de `AppLayout` (visível somente se `lojas.length > 1`), dropdown com nome da loja.

---

## PRIORIDADE 2 — Convites de membros

### Banco
- Tabela `convites_loja`:
  - `id uuid pk`, `loja_id uuid`, `email text`, `role text` (gerente|vendedor), `token uuid unique default gen_random_uuid()`, `status text default 'pending'` (pending|accepted|expired|cancelled), `convidado_por uuid`, `created_at`, `expires_at default now()+interval '7 days'`, `accepted_at`.
  - GRANT authenticated + anon SELECT (somente policy por token) + service_role.
  - RLS:
    - `admin/gerente da loja` → SELECT/INSERT/UPDATE/DELETE seus convites.
    - `anon` e `authenticated` → SELECT WHERE `token = current_setting('request.jwt.claim.token', true)` — na prática, leitura por token é feita via edge function com service role; manter RLS estrito (apenas membros da loja leem).
- Função `aceitar_convite(_token uuid)` SECURITY DEFINER: valida token, status pending, não expirado, insere `loja_usuarios`, marca aceito. Retorna `loja_id`.
- Edge function `enviar-convite` (verify_jwt=true): valida admin/gerente, cria registro, envia email com link `/aceitar-convite?token=...` via Lovable transactional email (`scaffold_transactional_email` + send-transactional-email).

### Frontend
- Página `/loja/equipe` (admin/gerente):
  - Lista membros (`loja_usuarios` + email do auth via edge function `listar-membros`).
  - Ações: alterar role (não permite rebaixar a si mesmo), remover membro.
  - Lista convites pendentes: reenviar / cancelar.
  - Form de convite (email + role).
- Página pública `/aceitar-convite?token=...`:
  - Edge function `validar-convite` retorna `{ loja_nome, email, role }` ou erro.
  - Se sem sessão → mostra signup/login com email pré-preenchido; após auth, chama `aceitar-convite-rpc`.
  - Se com sessão → confirma e chama RPC `aceitar_convite`.
  - Redireciona ao dashboard e seta a loja como ativa.
- Link "Equipe" no sidebar (visível para admin/gerente).

---

## PRIORIDADE 3 — Onboarding fiscal guiado

### Banco
- Adicionar coluna `lojas_config_fiscal.cert_pfx_base64 text` (ou usar storage privado `certificados-fiscais` — preferido).
- Bucket privado `certificados-fiscais` com RLS por loja_id (path `{loja_id}/cert.pfx`).
- Senha do certificado: armazenar em Supabase Vault via função SECURITY DEFINER `set_cert_senha(_loja_id, _senha)` que grava em `vault.secrets` com nome `cert_pwd_{loja_id}`. Remover coluna `cert_senha` (ou deixar nula e ignorar).
- Nada exposto via RLS pública.

### Edge function
- `cert-upload` (verify_jwt=true, admin only):
  - Recebe base64 + senha.
  - Valida o .pfx (tentativa de parse com node-forge ou similar via npm:).
  - Faz upload no bucket privado.
  - Salva senha no Vault.
  - Nunca loga conteúdo nem senha.

### Frontend
- `Onboarding.tsx`: novo Step 3 "Configuração Fiscal" (opcional, botão "Configurar depois").
  - Regime tributário (select), Ambiente (radio), Série NF-e, Série NFC-e, CSC ID, CSC Token (com tooltips), upload .pfx (≤2MB, valida extensão), senha.
- Página `/loja/fiscal-config` reaproveitando o mesmo componente do step 3.
- Badge no Dashboard:
  - 🔴 "Fiscal não configurado" → link `/loja/fiscal-config`
  - 🟡 "Em homologação" → link para alternar produção
  - 🟢 "Ativo em produção"
  - Lógica: query `lojas_config_fiscal` por `loja_id`; sem registro = vermelho; `ambiente='homologacao'` = amarelo; `ambiente='producao'` = verde.

---

## Rotas novas em `App.tsx`
- `/loja/equipe`
- `/loja/fiscal-config`
- `/aceitar-convite`

## Ordem de execução
1. Migration P1 + edge function + LojaContext + Switcher.
2. Validar funcionamento (criar segunda loja de teste).
3. Migration P2 (convites_loja + RPC) + edge functions + páginas equipe/aceitar-convite + email transacional.
4. Validar fluxo de convite end-to-end.
5. Migration P3 (bucket + vault) + edge function cert-upload + step 3 onboarding + página fiscal-config + badge.

## Notas técnicas
- Email transacional: usar `scaffold_transactional_email` (Lovable Emails), sem Resend.
- React Query: invalidar todas as queries após troca de loja (`queryClient.clear()`).
- Compatibilidade: `get_loja_id()` continua existindo como alias para não quebrar funções/triggers atuais.
- Responsividade: páginas /loja/equipe e /loja/fiscal-config usam padrões já existentes (Card + grid responsivo do projeto).
- Segurança: cert_pfx e senha jamais retornados em SELECT; somente edge functions com service role acessam.

Confirme se posso prosseguir com a Prioridade 1 primeiro (migration + edge function + contexto + switcher), e em seguida atacar P2 e P3 em rodadas separadas.
