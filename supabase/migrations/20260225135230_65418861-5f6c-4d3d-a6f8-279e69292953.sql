-- Add geolocation columns to tenants for distance-based sorting
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Allow anonymous users to read active tenants (for discover flow before auth)
CREATE POLICY "Anyone can view active tenants"
ON public.tenants
FOR SELECT
USING (ativo = true AND onboarding_completed = true);