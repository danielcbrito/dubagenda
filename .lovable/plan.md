## Diagnosis
The user is receiving two WhatsApp messages when an appointment is cancelled. The first message contains a red X and the cancellation header, while the second message starts with "Olá, [Name]".

Based on the investigation:
1. The database trigger `trg_notify_appointment_cancelled_whatsapp` generates a message starting with `❌ *Agendamento Cancelado*\n\nOlá...`.
2. The Edge Function `send-webhook-event` also generates a similar message using `\n\n`.
3. Some WhatsApp integrations (like Evolution API or N8N workflows) automatically split messages into multiple parts when they encounter a double newline (`\n\n`).
4. This results in the client receiving the header as one message and the greeting/body as a second message.

## Proposed Changes

### 1. Database Migrations
- Update `send_agendamento_whatsapp_webhook` to include the message at the root of the JSON payload (`'mensagem', p_msg`) to ensure Edge Functions can find it easily.
- Update `trg_notify_appointment_cancelled_whatsapp`, `trg_notify_new_appointment_whatsapp`, and `trg_send_confirm_message_on_barber_confirm` to use a single newline (`E'\n'`) instead of a double newline (`E'\n\n'`) after the header.

### 2. Edge Function Update
- Modify `supabase/functions/send-webhook-event/index.ts`:
  - Update `gerarMensagemPersonalizada` to use single newlines instead of double newlines for all message types to prevent splitting.
  - Update the payload processing logic to check for a message in `payload.contatos[0].mensagem` if `payload.mensagem` is missing at the root.
  - Prevent generating a new message if one is already provided in the payload (avoiding redundant work and potential duplicates).

### 3. Verification
- Verify that the triggers are correctly updated in the database.
- Deploy the updated Edge Function.
- Monitor `system_logs` to ensure messages are being processed as expected.

## Technical Details
- Use `regexp_replace` or simply change `E'\n\n'` to `E'\n'` in SQL.
- In TypeScript, change `\n\n` to `\n`.
- Ensure `v_payload` in SQL includes `'mensagem', p_msg` at the root.
