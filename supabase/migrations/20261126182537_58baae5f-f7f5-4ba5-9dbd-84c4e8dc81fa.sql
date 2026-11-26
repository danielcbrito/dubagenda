UPDATE public.pending_bookings p
SET expires_at = LEAST(p.expires_at, now())
WHERE p.id = '3dfac286-a321-4963-921f-6cad8904058b'::uuid
  AND p.user_id = '5d574ff2-4b2f-49d4-b260-1516a389cd80'::uuid
  AND p.barbeiro_id = 'c7fd6c11-fa5c-4b84-ab1f-691c2942461c'::uuid
  AND p.payment_intent_id IS NULL
  AND p.asaas_payment_id IS NULL
  AND p.pix_payload IS NULL
  AND EXISTS (SELECT 1 FROM public.barbeiros b WHERE b.id = p.barbeiro_id AND b.tenant_id = '2459facf-313e-4934-a815-f69a80d30a60'::uuid)
  AND NOT EXISTS (SELECT 1 FROM public.woovi_charges c WHERE c.pending_booking_id = p.id OR c.correlation_id = 'book-' || p.id::text);