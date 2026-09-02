-- Permitir que o usuário atualize seus próprios resgates (para marcar como usado ou expirado)
CREATE POLICY "Users can update own redemptions"
ON public.resgates
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
