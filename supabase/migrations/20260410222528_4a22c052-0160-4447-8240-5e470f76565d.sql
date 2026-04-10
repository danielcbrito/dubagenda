UPDATE public.assinaturas
SET
  ciclo_inicio = '2026-04-10',
  ciclo_fim = '2026-05-10',
  next_billing_date = '2026-05-10',
  usos_ciclo_atual = 0,
  total_renovacoes = total_renovacoes + 1,
  renovada_antecipadamente = true,
  payment_method = 'pix',
  status = 'active',
  pix_qr_code = NULL,
  pix_payload = NULL,
  pix_expires_at = NULL,
  asaas_payment_id = NULL,
  cash_payment_confirmed = NULL,
  updated_at = now()
WHERE id = 'c643c088-bd72-4b7e-832b-c24d40356ddf';