DROP POLICY IF EXISTS "Subscribers can view their subscribed plans" ON public.planos;
CREATE POLICY "Subscribers can view their subscribed plans"
ON public.planos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.plano_id = planos.id AND a.user_id = auth.uid()));