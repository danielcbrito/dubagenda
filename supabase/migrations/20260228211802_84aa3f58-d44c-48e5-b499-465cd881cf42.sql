-- Permitir que barbeiros atualizem assinaturas vinculadas a eles (confirmar pagamento cash)
CREATE POLICY "Barbers can update assigned subscriptions"
ON public.assinaturas
FOR UPDATE
USING (
  barbeiro_id IN (
    SELECT id FROM barbeiros WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  barbeiro_id IN (
    SELECT id FROM barbeiros WHERE user_id = auth.uid()
  )
);

-- Corrigir a assinatura do Daniel que ficou travada
UPDATE public.assinaturas 
SET cash_payment_confirmed = true, 
    status = 'active',
    next_billing_date = '2026-03-28'
WHERE id = '0a723171-f847-414f-a2a2-c92cba50f20e';
