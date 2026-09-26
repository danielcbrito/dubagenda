CREATE POLICY "Subscribers can view their subscribed plans"
ON public.planos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.plano_id = planos.id AND a.user_id = auth.uid() AND a.status IN ('active','pending_cash','pending_renewal','suspended','past_due')));

CREATE POLICY "Subscribers can view services of their plans"
ON public.servicos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.assinaturas a JOIN public.plano_servicos ps ON ps.plano_id = a.plano_id WHERE ps.servico_id = servicos.id AND a.user_id = auth.uid() AND a.status IN ('active','pending_cash','pending_renewal','suspended','past_due')));