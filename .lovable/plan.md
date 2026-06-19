## Multi-tenant (Rede → Lojas) com Dashboard Consolidado

### Objetivo
Permitir que uma "instituição" (franquia/rede) agrupe várias lojas, com RLS por `institution_id`, hierarquia de papéis Super Admin → Admin → Operador e um dashboard consolidado da rede.

### 1. Modelo de dados (migração SQL)

Nova tabela e ajustes:

- `public.institutions`
  - `nome text not null`
  - `cnpj text`
  - `owner_user_id uuid not null` (dono da rede)
  - `created_at`, `updated_at`
- `public.lojas`
  - adicionar `institution_id uuid references institutions(id) on delete set null`
  - index em `institution_id`
- `public.institution_usuarios` (membros da rede, separa do `loja_usuarios`)
  - `institution_id, user_id, role text check in ('owner','network_admin')`
  - unique `(institution_id, user_id)`
- Enum `app_role` já existe — adicionar valor `network_owner` (alias do owner da rede). Mantemos `super_admin` (global da plataforma) intocado.
- Papéis por loja em `loja_usuarios.role` continuam: `admin`, `gerente`, `vendedor`. Renomear conceito: **Admin (loja) = `admin`**, **Operador (caixa) = `vendedor`** (sem mudar valores no banco; só rótulos na UI).

### 2. RLS e funções

Novas funções `security definer`:
- `public.get_user_institutions()` → uuid[]
- `public.is_institution_owner(_inst uuid)` → boolean
- `public.has_institution_access(_inst uuid)` → boolean (owner OU network_admin OU super_admin)

Policies:
- `institutions`: SELECT se `has_institution_access(id)`; INSERT por usuário autenticado (vira owner); UPDATE/DELETE só owner ou super_admin.
- `institution_usuarios`: SELECT/INSERT/UPDATE/DELETE só owner da institution (ou super_admin). Trigger anti-self-escalation análogo ao já existente em `loja_usuarios`.
- `lojas`: estender SELECT/UPDATE atuais para também permitir quando `has_institution_access(institution_id)`.
- Tabelas dependentes (`vendas`, `produtos`, `clientes`, `estoque`, `recibos`, `venda_itens`, `movimentacoes_estoque`, `notas_fiscais`, `cupons`, `maquininhas`): adicionar policy SELECT extra "network read" via join em `lojas.institution_id` usando `has_institution_access`. Mantemos escrita restrita à loja (sem mudança).
- GRANT statements em toda tabela nova.

### 3. RPC para o dashboard consolidado

`public.network_dashboard(_inst uuid, _from date, _to date)` (security definer, valida acesso via `has_institution_access`):

Retorna JSON com:
- `por_loja`: `[{ loja_id, nome, vendas_count, faturamento_total, ticket_medio }]`
- `totais`: `{ vendas, faturamento, ticket_medio, num_lojas }`
- `serie_diaria`: `[{ data, faturamento }]` (para gráfico)
- `ranking`: top/bottom lojas por faturamento

Considera apenas `vendas.status = 'concluida'` no período.

### 4. Frontend

Novas páginas:
- `/rede` — Dashboard consolidado da rede
  - Seletor de período (presets 7/30/90 dias + custom)
  - KPIs: faturamento total, nº vendas, ticket médio, nº lojas
  - Gráfico de série diária (recharts já está no projeto)
  - Tabela comparativa por loja (ordenável)
  - Botão **Exportar CSV** do período
- `/rede/configuracoes` — CRUD da instituição: nome, CNPJ, membros (network_admin), vincular/desvincular lojas que o usuário já administra.

Componentes:
- `NetworkGuard` (similar ao gate de `Admin.tsx`) — usa `has_institution_access`.
- Item de menu "Rede" na sidebar, visível só quando o usuário tem ao menos uma institution.
- Hook `useInstitutions()` no padrão de `LojaContext` (read-only; sem switcher por enquanto — assume primeira institution do usuário; pode-se evoluir depois).

Export CSV: gerado client-side a partir do JSON do RPC (Blob + download), colunas: data, loja, vendas, faturamento, ticket médio.

### 5. Rótulos de papéis (apenas UI)

Em telas que mostram `role` de `loja_usuarios`:
- `admin` → "Admin da loja"
- `gerente` → "Gerente"
- `vendedor` → "Operador (caixa)"

Sem migração de dados.

### 6. Fora de escopo (deixar para depois)

- Switcher de institution no header (só leremos a primeira).
- Convites por email para `institution_usuarios` (criação será manual via tela de configurações por enquanto, adicionando por user_id ou email já cadastrado).
- Permissões finas dentro da loja para "operador" — mantemos as regras atuais de `vendedor`.

### Detalhes técnicos

Arquivos a criar/editar:

```text
supabase/migrations/<ts>_multi_tenant_network.sql   (novo)
src/contexts/InstitutionContext.tsx                 (novo)
src/components/NetworkGuard.tsx                     (novo)
src/pages/RedeDashboard.tsx                         (novo)
src/pages/RedeConfiguracoes.tsx                     (novo)
src/lib/exportCsv.ts                                (novo)
src/App.tsx                                         (rotas /rede, /rede/configuracoes)
src/components/AppSidebar.tsx                       (item "Rede")
```

Ordem de execução: (1) migração, (2) após aprovação dos types, implementar frontend + RPC consumers.