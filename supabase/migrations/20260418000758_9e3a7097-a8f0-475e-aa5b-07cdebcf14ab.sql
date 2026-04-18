-- 1. Adicionar coluna pending_booking_id se não existir
ALTER TABLE public.efi_pix_charges
  ADD COLUMN IF NOT EXISTS pending_booking_id UUID REFERENCES public.pending_bookings(id) ON DELETE SET NULL;

-- 2. Criar índices restantes (idempotente)
CREATE INDEX IF NOT EXISTS idx_efi_charges_status ON public.efi_pix_charges(status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_efi_charges_user ON public.efi_pix_charges(user_id);
CREATE INDEX IF NOT EXISTS idx_efi_charges_pending_booking ON public.efi_pix_charges(pending_booking_id);

-- 3. Criar tabela de credenciais criptografadas
CREATE TABLE IF NOT EXISTS public.efi_credenciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbeiro_id UUID NOT NULL UNIQUE REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  client_id_encrypted TEXT NOT NULL,
  client_id_iv TEXT NOT NULL,
  client_id_auth_tag TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  client_secret_iv TEXT NOT NULL,
  client_secret_auth_tag TEXT NOT NULL,
  cert_p12_encrypted TEXT NOT NULL,
  cert_p12_iv TEXT NOT NULL,
  cert_p12_auth_tag TEXT NOT NULL,
  pix_key TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ambiente TEXT NOT NULL DEFAULT 'production' CHECK (ambiente IN ('production','homolog')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.efi_credenciais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins manage efi_credenciais" ON public.efi_credenciais;
CREATE POLICY "Only admins manage efi_credenciais"
ON public.efi_credenciais FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_efi_credenciais_updated_at ON public.efi_credenciais;
CREATE TRIGGER set_efi_credenciais_updated_at
BEFORE UPDATE ON public.efi_credenciais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS para efi_pix_charges (caso ainda não tenha)
ALTER TABLE public.efi_pix_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.efi_pix_charges REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "Users view own efi charges" ON public.efi_pix_charges;
CREATE POLICY "Users view own efi charges"
ON public.efi_pix_charges FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage all efi charges" ON public.efi_pix_charges;
CREATE POLICY "Admins manage all efi charges"
ON public.efi_pix_charges FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role manages efi charges" ON public.efi_pix_charges;
CREATE POLICY "Service role manages efi charges"
ON public.efi_pix_charges FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 5. RPC validar credenciais Efí
CREATE OR REPLACE FUNCTION public.validate_barber_can_receive_pix(p_barbeiro_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.efi_credenciais ec
    JOIN public.barbeiros b ON b.id = ec.barbeiro_id
    WHERE ec.barbeiro_id = p_barbeiro_id
      AND ec.ativo = true
      AND b.ativo = true
      AND b.deleted_at IS NULL
  );
$$;

-- 6. Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.efi_pix_charges;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;