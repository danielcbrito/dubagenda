
-- Add preferred barbershop and signup origin to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS barbearia_preferida_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS signup_origin text DEFAULT 'dub_exclusive';

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_barbearia_preferida ON public.profiles(barbearia_preferida_id) WHERE barbearia_preferida_id IS NOT NULL;

-- Allow clients to read active tenants (for barbershop selection)
CREATE POLICY "Authenticated users can view active tenants"
ON public.tenants
FOR SELECT
TO authenticated
USING (ativo = true AND onboarding_completed = true);

-- Allow clients to update their own preferred barbershop
CREATE POLICY "Users can update their own barbearia_preferida"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
