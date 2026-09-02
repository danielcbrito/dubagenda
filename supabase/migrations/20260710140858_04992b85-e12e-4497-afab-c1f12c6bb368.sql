
-- 1) Validação: só bloqueia se o hash pertence a OUTRO profile ainda existente.
CREATE OR REPLACE FUNCTION public.validar_identidade_duplicada(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
    SELECT 1 FROM public.identidades_usadas iu
    WHERE iu.primeiro_profile_id IS NOT NULL
      AND iu.primeiro_profile_id <> p_profile_id
      AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = iu.primeiro_profile_id)
      AND ( (v_cpf_hash IS NOT NULL AND iu.cpf_hash = v_cpf_hash)
         OR (v_tel_hash IS NOT NULL AND iu.telefone_hash = v_tel_hash)
         OR (v_email    IS NOT NULL AND iu.email        = v_email) )
  );
END;
$function$;

-- 2) Registro de identidade: adota hashes órfãos em vez de falhar por conflito.
CREATE OR REPLACE FUNCTION public.registrar_identidade_usada(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
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
    ON CONFLICT (cpf_hash) DO UPDATE SET primeiro_profile_id = COALESCE(public.identidades_usadas.primeiro_profile_id, EXCLUDED.primeiro_profile_id);
  END IF;
  IF v_tel_hash IS NOT NULL THEN
    INSERT INTO public.identidades_usadas (telefone_hash, primeiro_profile_id) VALUES (v_tel_hash, p_profile_id)
    ON CONFLICT (telefone_hash) DO UPDATE SET primeiro_profile_id = COALESCE(public.identidades_usadas.primeiro_profile_id, EXCLUDED.primeiro_profile_id);
  END IF;
  IF v_email IS NOT NULL THEN
    INSERT INTO public.identidades_usadas (email, primeiro_profile_id) VALUES (v_email, p_profile_id)
    ON CONFLICT (email) DO UPDATE SET primeiro_profile_id = COALESCE(public.identidades_usadas.primeiro_profile_id, EXCLUDED.primeiro_profile_id);
  END IF;
END;
$function$;

-- 3) Limpa a indicação incorreta do último cadastro (Pablo) e re-registra corretamente.
DELETE FROM public.indicacoes
 WHERE indicado_id = '5cdcbd85-db72-4253-a926-1265ae422a14'
   AND status = 'invalidado'
   AND motivo_invalidacao ILIKE '%Identidade%';

-- Reivindica hashes órfãos para esse profile
SELECT public.registrar_identidade_usada('5cdcbd85-db72-4253-a926-1265ae422a14'::uuid);

-- Re-registra a indicação (agora vai validar como pendente, não invalidado)
SELECT public.registrar_indicacao(
  '5cdcbd85-db72-4253-a926-1265ae422a14'::uuid,
  'PB85FT4U',
  NULL
);
