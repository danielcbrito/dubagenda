REVOKE ALL ON public.whatsapp_signup_otp FROM anon, authenticated;
DO $$
DECLARE test_id uuid; generated_code text;
BEGIN
  BEGIN
    generated_code := (100000 + floor(random() * 900000))::integer::text;
    INSERT INTO public.whatsapp_signup_otp(phone, code, expires_at) VALUES ('test-no-delivery', generated_code, now() + interval '5 minutes') RETURNING id INTO test_id;
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_signup_otp WHERE id = test_id AND code ~ '^[0-9]{6}$' AND attempts = 0 AND verified_at IS NULL AND expires_at > now()) THEN
      RAISE EXCEPTION 'OTP storage regression failed';
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'Rollback test fixture';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
  END;
END $$;
NOTIFY pgrst, 'reload schema';