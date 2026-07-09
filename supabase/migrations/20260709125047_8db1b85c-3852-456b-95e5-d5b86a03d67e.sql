
CREATE OR REPLACE FUNCTION public.registrar_identidade_usada(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_cpf text; v_tel text; v_email text;
  v_cpf_hash text; v_tel_hash text;
BEGIN
  SELECT regexp_replace(COALESCE(cpf,''), '\D', '', 'g'),
         regexp_replace(COALESCE(telefone,''), '\D', '', 'g')
    INTO v_cpf, v_tel FROM public.profiles WHERE id = p_profile_id;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_profile_id;
  v_cpf_hash := CASE WHEN v_cpf = '' THEN NULL ELSE encode(extensions.digest(v_cpf, 'sha256'), 'hex') END;
  v_tel_hash := CASE WHEN v_tel = '' THEN NULL ELSE encode(extensions.digest(v_tel, 'sha256'), 'hex') END;

  IF v_cpf_hash IS NOT NULL THEN
    INSERT INTO public.identidades_usadas (cpf_hash, primeiro_profile_id) VALUES (v_cpf_hash, p_profile_id)
    ON CONFLICT (cpf_hash) DO NOTHING;
  END IF;
  IF v_tel_hash IS NOT NULL THEN
    INSERT INTO public.identidades_usadas (telefone_hash, primeiro_profile_id) VALUES (v_tel_hash, p_profile_id)
    ON CONFLICT (telefone_hash) DO NOTHING;
  END IF;
  IF v_email IS NOT NULL THEN
    INSERT INTO public.identidades_usadas (email, primeiro_profile_id) VALUES (v_email, p_profile_id)
    ON CONFLICT (email) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_identidade_duplicada(p_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_cpf text; v_tel text; v_email text;
  v_cpf_hash text; v_tel_hash text;
BEGIN
  SELECT regexp_replace(COALESCE(cpf,''), '\D', '', 'g'),
         regexp_replace(COALESCE(telefone,''), '\D', '', 'g')
    INTO v_cpf, v_tel FROM public.profiles WHERE id = p_profile_id;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_profile_id;
  v_cpf_hash := CASE WHEN v_cpf = '' THEN NULL ELSE encode(extensions.digest(v_cpf, 'sha256'), 'hex') END;
  v_tel_hash := CASE WHEN v_tel = '' THEN NULL ELSE encode(extensions.digest(v_tel, 'sha256'), 'hex') END;
  RETURN EXISTS (
    SELECT 1 FROM public.identidades_usadas
    WHERE primeiro_profile_id IS DISTINCT FROM p_profile_id
      AND ( (v_cpf_hash IS NOT NULL AND cpf_hash = v_cpf_hash)
         OR (v_tel_hash IS NOT NULL AND telefone_hash = v_tel_hash)
         OR (v_email IS NOT NULL AND email = v_email) )
  );
END;
$$;
