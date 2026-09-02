# CHANGELOG

## [1.0.0] - 2026-03-09 — Refatoração: Separação do App do Cliente

### Arquivos Removidos

| Arquivo | Categoria | Motivo |
|---|---|---|
| `src/pages/Admin.tsx` | Migrado para app do barbeiro | Painel administrativo completo |
| `src/pages/TI.tsx` | Migrado para app do barbeiro | Painel de TI/DevOps |
| `src/pages/AgendaFullScreen.tsx` | Migrado para app do barbeiro | Visualização fullscreen da agenda |
| `src/pages/AdminRelatoriosMensais.tsx` | Migrado para app do barbeiro | Relatórios financeiros mensais |
| `src/components/admin/*` (diretório completo) | Migrado para app do barbeiro | Todos os componentes administrativos (Dashboard, Agenda, Timeline, Sidebar, Financeiro, Configurações, etc.) |
| `src/components/ti/*` (diretório completo) | Migrado para app do barbeiro | Componentes do painel TI (Dashboard, Logs, Webhooks, Manutenção, etc.) |
| `src/hooks/useBarbeiroLogado.ts` | Código morto | Hook usado exclusivamente por componentes admin removidos |
| `src/components/ui/chart.tsx` | Código morto | Wrapper do Recharts, usado apenas em AdminDashboard e AdminFinanceiro |

### Dependências Removidas

| Pacote | Motivo |
|---|---|
| `recharts` | Usado exclusivamente em componentes administrativos removidos |

### Bugs Corrigidos

#### 1. Race Condition na Verificação de Disponibilidade (Instrução 5)
- **Antes:** `verifySlotAvailability` no frontend fazia double-check no Passo 4, mas a verificação real ocorria novamente no `atomic-booking`. Entre as duas verificações, outro cliente podia reservar o horário.
- **Depois:** Verificação de frontend removida. A única validação de conflito é feita atomicamente dentro da Edge Function `atomic-booking` no Passo 6.
- **Arquivo:** `src/pages/ClienteAgendar.tsx`

#### 2. Mapeamento Hardcoded de Planos no Stripe (Instrução 7)
- **Antes:** `PLAN_PRICE_MAP` era um objeto fixo com UUIDs hardcoded mapeando planos internos para `price_id` do Stripe.
- **Depois:** O `stripe_price_id` é buscado dinamicamente da tabela `planos` no banco de dados. Novos planos só precisam ter essa coluna preenchida.
- **Arquivo:** `supabase/functions/create-checkout/index.ts`

### Novas Funcionalidades

#### Utilitário de Tenant Centralizado (Instrução 9)
- **Arquivo criado:** `src/utils/tenantQuery.ts`
- **Funções:** `buildBarberQuery(tenantId, unidadeId?)` e `applyTenantFilter(query, tenantId)`
- **Propósito:** Centralizar a lógica de filtro por tenant, incluindo o tratamento legado de `tenant_id IS NULL` para a Barbearia DUB.

### Migrações de Banco de Dados

| Alteração | Descrição |
|---|---|
| `planos.stripe_price_id` (text, nullable) | Nova coluna para mapeamento dinâmico de planos para preços do Stripe |

### Notas para Desenvolvedores

1. **Planos e Stripe:** Para que um plano funcione com checkout Stripe, o campo `stripe_price_id` deve ser preenchido com o ID de preço correspondente (ex: `price_1T08CFLN5yQChZnofK09gVvo`).
2. **Tenant Query:** Ao criar novas queries filtradas por tenant, use `buildBarberQuery()` ou `applyTenantFilter()` de `src/utils/tenantQuery.ts` em vez de espalhar lógica `.is('tenant_id', null)` pelo código.
3. **Verificação de Disponibilidade:** A verificação final de conflito de horário acontece EXCLUSIVAMENTE dentro da Edge Function `atomic-booking`. O frontend não deve duplicar essa verificação.
