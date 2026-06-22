# Diagnóstico — Reembolso da carteira sem chave Pix

## Problema observado
- Mensagem no preview: `Edge function returned 400: {"error":"Chave Pix inválida"}`.
- Rota afetada: `/cliente/carteira`.
- Função afetada: `supabase/functions/wallet-operations/index.ts`.

## Diagnóstico técnico
- O frontend atual chama o reembolso com o corpo:
  - Preview: `{ "action": "withdraw" }`
  - Confirmação: `{ "action": "withdraw", "confirmed": true }`
- Nenhuma tela da carteira envia `pixKey` para confirmar reembolso.
- O trecho `withdraw` da Edge Function foi ajustado para não ler, validar ou repassar chave Pix.
- A chamada para Woovi no reembolso usa somente:
  - `correlationID`
  - `transactionEndToEndId`
  - `value`
- O registro de saque em `wallet_transactions` grava `destination_pix_key: null`.

## Causa provável
- A função Edge publicada estava executando uma versão antiga em produção/cache, ainda com validação de chave Pix.
- Não há trigger ou constraint no banco `wallet_transactions` que gere a mensagem `Chave Pix inválida`.

## Correção aplicada
- Removido qualquer acoplamento de chave Pix do fluxo `withdraw`.
- Adicionado marcador de versão nos logs da Edge Function:
  - `wallet-refund-origin-account-2026-06-22T2355Z`
- Redeploy da função `wallet-operations` executado após a correção.

## Fluxo correto agora
1. Cliente abre a carteira.
2. Frontend chama `wallet-operations` com `action: "withdraw"` para obter preview.
3. Backend calcula o valor limitado pelo saldo real da carteira.
4. Backend desconta a taxa real Woovi encontrada em `woovi_charges.raw_response`.
5. Cliente confirma.
6. Backend chama Woovi `/api/v1/refund` usando `transactionEndToEndId`, sem chave Pix.
7. Woovi devolve para a conta de origem do Pix.
8. Backend marca o crédito como consumido e registra o saque com `destination_pix_key = null`.

## Como validar nos logs
Procure na Edge Function `wallet-operations` por:

```txt
version=wallet-refund-origin-account-2026-06-22T2355Z
withdraw_refund_mode=origin_account_no_pix_key
```

Se esses logs aparecerem, a versão correta está rodando.