-- Permitir armazenar a senha do .p12 criptografada para reconversão futura, se necessário
ALTER TABLE public.efi_credenciais
  ADD COLUMN IF NOT EXISTS cert_password_encrypted text,
  ADD COLUMN IF NOT EXISTS cert_password_iv text,
  ADD COLUMN IF NOT EXISTS cert_password_auth_tag text,
  ADD COLUMN IF NOT EXISTS test_connection_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_connection_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_pix_ok boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_pix_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_pix_e2e_id text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid;

-- Garantir que só admins possam ler/escrever credenciais
DROP POLICY IF EXISTS "Admins manage efi_credenciais" ON public.efi_credenciais;
CREATE POLICY "Admins manage efi_credenciais"
ON public.efi_credenciais
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));