# Carteira do Cliente — Woovi Reembolso PIX

> Documento técnico vivo. Atualize ao alterar fluxo de carteira/reembolso.

## 1. Modelo de negócio

- Cancelamento de agendamento pago via **PIX** → **valor TOTAL** é creditado
  na carteira interna do cliente (`wallet_balances`).
- O cliente decide **quando** solicitar o reembolso (saque PIX via Woovi).
- **Taxa: R$ 0,50 por cancelamento** (não por saque). Saldo de
  `3 × R$ 5,00 = R$ 15,00` → reembolso líquido `R$ 15,00 − 3 × R$ 0,50 = R$ 13,50`.
- Cartão e crédito do app: crédito total na carteira, **sem taxa** (saque
  PIX cobra taxa apenas em créditos com origem PIX/Woovi).

## 2. Camadas

### Usuário
- `src/pages/ClienteCarteira.tsx` — tela de carteira do cliente.
- `src/components/WalletSheet.tsx` — sheet de saldo + ações.
- `src/hooks/useWalletStatus.ts` — saldo + estado da carteira.

### Frontend
- Invoca `supabase.functions.invoke("wallet-operations", { body: { action } })`.
- Ações: `get_balance`, `get_transactions`, `recharge`, `withdraw` (com fluxo
  preview/confirm), `convert_credits`, `pay_service`, `check_recharge_status`,
  `transfer`.

### Backend (Edge Functions Deno)
- `supabase/functions/wallet-operations/index.ts` — operações da carteira.
- `supabase/functions/cancel-appointment-client/index.ts` — credita carteira
  ao cancelar.
- `supabase/functions/woovi-create-charge/index.ts` — cria cobrança PIX
  (rota direto para subconta do barbeiro — fiscal/Receita Federal).
- `supabase/functions/woovi-webhook/index.ts` — confirma pagamentos PIX.

### Database (Supabase)
- `wallet_balances (user_id, balance)` — saldo único por cliente.
- `wallet_transactions (user_id, type, amount, status, description,
   destination_pix_key, metadata jsonb)` — histórico.
  - `type`: `refund` (crédito de cancelamento), `payment`, `recharge`,
    `withdraw`, `transfer`, `convert_credits`.
  - `status`: `pending` | `completed` | `consumed` | `partial`.
  - `metadata` para créditos PIX:
    `{ source: "pix_cancellation", woovi_correlation_id, woovi_endToEndId,
       woovi_subPixKey, woovi_value_centavos, agendamento_id }`.
- `woovi_charges (agendamento_id, status, correlation_id, value_centavos,
   raw_response jsonb)` — cobranças geradas.

### Serviços externos
- **Woovi**: `POST https://api.woovi.com/api/v1/refund` autenticado com
  header `Authorization: $ID_DO_APLICATIVO_WOOVI`.
  Body: `{ correlationID, transactionEndToEndId, value (centavos), pixKey }`.

## 3. Fluxos críticos

### 3.1 Cancelamento PIX → crédito na carteira

```
Cliente cancela
  └─> cancel-appointment-client (JWT)
        ├─> valida ownership do agendamento
        ├─> UPDATE agendamentos SET status='cancelled_by_user'
        ├─> SELECT woovi_charges WHERE agendamento_id=X AND status='PAID'
        ├─> extrai endToEndId + subPixKey de raw_response
        ├─> UPDATE wallet_balances += amount
        ├─> INSERT wallet_transactions (type='refund', amount=total,
        │     metadata={woovi_endToEndId, woovi_subPixKey, ...})
        └─> INSERT notificacoes ("R$ X creditado na sua carteira")
```

**Idempotência**: `correlation_id` único por crédito; reuso bloqueado por
`status='consumed'` após saque.

**Erros**:
- Sem `woovi_charges` PAID → credita assim mesmo (sem metadata Woovi); o
  saque PIX para esse crédito ficará indisponível, mas o saldo é usável em
  outras ações (pagar serviço, transferir).
- `UPDATE agendamentos` falha → propaga 500, nada é creditado.

### 3.2 Solicitar reembolso (saque PIX)

Fluxo em **dois passos** para mostrar a taxa antes de confirmar:

#### Passo 1 — preview
```
UI → wallet-operations { action:"withdraw" }   (sem confirmed)
      ├─> lista wallet_transactions type='refund', status='completed',
      │     metadata.woovi_endToEndId NOT NULL
      ├─> grossAmount = Σ amount
      ├─> totalFee   = count × R$ 0,50
      ├─> netAmount  = grossAmount - totalFee
      └─> retorna { preview:true, credits[], grossAmount, totalFee,
                    netAmount, message }
```

UI exibe modal: "Você vai receber R$ X. Serão descontados N × R$ 0,50."

#### Passo 2 — confirm
```
UI → wallet-operations { action:"withdraw", confirmed:true, pixKey }
      ├─> valida pixKey
      ├─> para CADA crédito (FIFO):
      │     ├─> POST /api/v1/refund Woovi
      │     │     { correlationID, transactionEndToEndId,
      │     │       value=(valor-0,50)*100, pixKey }
      │     ├─> se OK → marca crédito 'consumed'
      │     └─> se FALHA → break (cliente reprocessa depois)
      ├─> UPDATE wallet_balances -= Σ(créditos reembolsados)
      └─> INSERT wallet_transactions (type='withdraw', status='completed' |
            'partial', metadata={credits_count, total_fee, net_amount,
            source_credit_ids, partial_failures})
```

**Reembolso parcial** é tratado: o saldo só desce o valor dos créditos
efetivamente reembolsados; o resto continua disponível.

### 3.3 Pagar serviço com saldo
`pay_service` → debita `wallet_balances` e registra `type='payment'`.

## 4. Segurança

| Camada | Proteção |
|---|---|
| Edge functions | JWT obrigatório (`getUser(token)`) |
| Ownership | `user_id == auth.uid()` antes de qualquer mutação |
| Idempotência | `correlation_id` único por crédito; `status='consumed'` evita duplo saque |
| RLS | `wallet_balances`, `wallet_transactions`, `woovi_charges` filtram por `user_id` |
| Service role | Apenas dentro das edge functions, nunca no frontend |

## 5. Secrets (Supabase)
- `ID_DO_APLICATIVO_WOOVI` — header Authorization na API Woovi.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — auto.

## 6. Erros e fallbacks

| Cenário | Resposta |
|---|---|
| Sem créditos PIX para saque | 400 `"Sem saldo de cancelamento PIX..."` |
| Chave PIX inválida (<5 chars) | 400 `"Chave PIX inválida"` |
| Woovi 4xx/5xx no 1º crédito | 502 + detalhes; nada é debitado |
| Woovi falha após N sucessos | 200 `status='partial'`; debita só os OK |
| Sem `ID_DO_APLICATIVO_WOOVI` | 500 `"Gateway Woovi não configurado"` |
| Agendamento sem `woovi_charges` PAID | Crédito sem metadata Woovi (não saca via PIX) |
