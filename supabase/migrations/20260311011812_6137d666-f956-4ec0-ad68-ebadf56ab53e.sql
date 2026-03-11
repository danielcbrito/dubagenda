-- Allow anyone (authenticated or anonymous) to read active tenant_unidades
-- This is needed for the "Nossas Unidades" section on public barbershop pages
-- and for clients viewing their preferred barbershop's units
CREATE POLICY "public_read_tenant_unidades"
  ON public.tenant_unidades
  FOR SELECT
  TO anon, authenticated
  USING (true);
