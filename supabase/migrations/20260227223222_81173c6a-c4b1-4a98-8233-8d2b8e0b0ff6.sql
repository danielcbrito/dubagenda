-- Allow users to insert their own subscriptions
CREATE POLICY "Users can create own subscriptions"
ON public.assinaturas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own pending/suspended subscriptions
CREATE POLICY "Users can delete own pending subscriptions"
ON public.assinaturas
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND status IN ('suspended', 'pending_cash'));
