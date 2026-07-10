CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  v_phone := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'telefone', ''), '\D', '', 'g');

  INSERT INTO public.profiles (id, nome, telefone, referral_code)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nome', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      split_part(NEW.email, '@', 1)
    ),
    NULLIF(v_phone, ''),
    public.gerar_referral_code()
  )
  ON CONFLICT (id) DO UPDATE
    SET
      nome = COALESCE(NULLIF(public.profiles.nome, ''), EXCLUDED.nome),
      telefone = COALESCE(NULLIF(public.profiles.telefone, ''), EXCLUDED.telefone),
      referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;