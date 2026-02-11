-- Permite que qualquer usuário autenticado consulte cupons ativos (necessário para validação no fluxo de agendamento)
CREATE POLICY "Authenticated users can read active coupons"
ON public.discount_coupons
FOR SELECT
TO authenticated
USING (active = true);