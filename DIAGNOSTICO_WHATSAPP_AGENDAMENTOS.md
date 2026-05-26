# Diagnóstico — Notificações WhatsApp de Agendamento

Data: 26/05/2026
Responsável técnico: Equipe Lovable

## 1. Resumo executivo
- O envio das mensagens de WhatsApp dos agendamentos sai corretamente do Supabase.
- O webhook do n8n responde HTTP **200 "Workflow was started"** em todos os agendamentos recentes.
- Se a mensagem não chegou no WhatsApp do cliente final, o problema está **dentro do fluxo do n8n / Evolution API**, não no Supabase.

## 2. Camadas auditadas

### 2.1 Database (Supabase)
Triggers ativos em `public.agendamentos`:
- `trg_notify_new_appointment_whatsapp` (AFTER INSERT) — dispara `novo_agendamento` quando `barbeiro_confirmou = false`.
- `trg_send_confirm_message_on_barber_confirm` (AFTER INSERT/UPDATE) — dispara `agendamento_confirmado` quando `barbeiro_confirmou = true` e `status = 'confirmed'`.

Como o fluxo do cliente cria o agendamento **já confirmado** (auto-confirmação), só o trigger de `agendamento_confirmado` dispara — comportamento correto.

Helper centralizado: `public.send_agendamento_whatsapp_webhook(p_agendamento_id, p_kind, p_msg)`.

### 2.2 Backend N8N (Webhook)
Configuração ativa em `webhook_config` (linha mais recente):
- `webhook_url` (genérico) ✅ ativo → `…/webhook/232bcbe8-99c8-4fb9-bea8-03b5d2076ea1`
- `confirmacao_webhook_url` ✅ ativo → `…/webhook/9b355263-4a79-459b-b024-8c005e6612c4`
- `lembrete_webhook_url` ✅ ativo → `…/webhook/a6ed68fd-3eaf-4aed-9ada-4c6aea494d50`

A função de envio foi corrigida para **rotear pelo webhook correto conforme o tipo do evento**, com fallback para o webhook genérico.

### 2.3 External Services (Evolution API / WhatsApp)
- Instância usada: `barbearia_dub_tulio_santos` (status `connected`).
- Telefone do cliente formatado corretamente: `5511952160719@s.whatsapp.net`.
- Payload do webhook contém `instance_name`, `api_key`, mensagem pronta e contato.

## 3. Correções aplicadas (migration)

Função `public.send_agendamento_whatsapp_webhook` foi reescrita com:

1. **Roteamento correto de webhook**
   - `agendamento_confirmado` → `confirmacao_webhook_url` (se ativo)
   - `reminder_*` / `*lembrete*` → `lembrete_webhook_url` (se ativo)
   - Outros → `webhook_url` genérico
2. **Validação prévia** antes de tentar enviar:
   - Telefone do cliente presente
   - Instância WhatsApp `connected` no tenant
   - URL do webhook configurada e ativa
   - Se falhar, registra log com `status='error'` e `reason` explícito (`missing_client_phone`, `missing_connected_whatsapp_instance`, `missing_active_webhook_url`).
3. **Log enriquecido** em `agendamento_lembretes_log.details`:
   - `webhook_type`, `webhook_url_used`
   - `whatsapp_instance_name`, `whatsapp_instance_barbeiro_id/nome`
   - `cliente_nome`, `cliente_telefone_whatsapp`
   - `barbeiro_id/nome`, `servico_id/nome`, `tenant_id`, `preco_enviado`
4. **Status `queued`** (em vez de `sent` antes da confirmação do `pg_net`), para refletir o estado real até a resposta HTTP ser registrada em `net._http_response`.
5. **Tratamento de exceções**: qualquer erro inesperado é gravado como `status='error'` em vez de quebrar silenciosamente.

## 4. Teste ponta a ponta executado

```text
RPC: send_agendamento_whatsapp_webhook(
       'b5cea335-…', 'teste_manual_diagnostico',
       '🔧 TESTE DUB Agenda…')
→ net_request_id = 142907

net._http_response[142907]:
  status_code = 200
  content     = {"message":"Workflow was started"}
  timed_out   = false
```

Resultado: o Supabase **realmente entrega** o payload ao n8n.

## 5. Próximos passos para o lado do N8N (fora do Supabase)

Se o WhatsApp do cliente continuar sem receber:
1. Abrir o workflow `232bcbe8-99c8-4fb9-bea8-03b5d2076ea1` no n8n e verificar:
   - Execuções recentes — devem estar marcadas como **sucesso**.
   - Step da Evolution API — confirmar que o número não está bloqueado e que a instância `barbearia_dub_tulio_santos` está autenticada.
2. Repetir a verificação no workflow de confirmação `9b355263-4a79-459b-b024-8c005e6612c4`.
3. Conferir se o n8n não está em modo "Test" (que só responde ao primeiro request).

## 6. Critério de "perfeito"
- [x] Rotear evento → webhook certo.
- [x] Não marcar como enviado antes da entrega real.
- [x] Logs com causa raiz quando o envio é abortado.
- [x] Teste real com HTTP 200 do n8n.
- [ ] Confirmação visual de mensagem chegando no WhatsApp do cliente — depende do workflow no n8n (fora do Supabase).
