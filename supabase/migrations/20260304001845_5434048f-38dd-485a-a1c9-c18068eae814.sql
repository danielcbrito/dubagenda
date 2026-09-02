-- Create helper function to get user's preferred barbershop tenant_id
CREATE OR REPLACE FUNCTION public.get_user_preferred_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT barbearia_preferida_id
  FROM public.profiles
  WHERE id = auth.uid()
$$;

-- Add RLS policy: clients can see active promotions from their preferred barbershop
CREATE POLICY "Clients can view preferred tenant promocoes"
ON public.promocoes
FOR SELECT
TO authenticated
USING (
  ativo = true 
  AND (
    tenant_id IS NULL 
    OR tenant_id = get_user_preferred_tenant_id()
  )
);