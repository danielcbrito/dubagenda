
CREATE TABLE IF NOT EXISTS public.whatsapp_signup_otp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  verification_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_signup_otp_phone ON public.whatsapp_signup_otp(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_signup_otp_token ON public.whatsapp_signup_otp(verification_token);

-- Only service_role (edge functions) can access; no anon/authenticated grants.
GRANT ALL ON public.whatsapp_signup_otp TO service_role;

ALTER TABLE public.whatsapp_signup_otp ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: RLS enabled + no policy = deny by default.
CREATE POLICY "service_role manages signup otp"
  ON public.whatsapp_signup_otp
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
