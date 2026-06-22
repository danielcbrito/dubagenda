ALTER TABLE public.woovi_charges ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_woovi_charges_user_id ON public.woovi_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_woovi_charges_correlation_id ON public.woovi_charges(correlation_id);

DROP POLICY IF EXISTS "Cliente vê sua própria charge Woovi" ON public.woovi_charges;
CREATE POLICY "Cliente vê sua própria charge Woovi"
  ON public.woovi_charges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());