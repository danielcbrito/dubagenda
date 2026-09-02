-- 1) Função de normalização de telefone brasileiro
-- Retorna sempre 11 dígitos (DDD + 9 + 8) para celular ou 10 (DDD + 8) para fixo.
-- Remove DDI 55 quando presente. Retorna NULL para entradas fora do padrão BR.
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v text;
  v_ddd text;
  v_rest text;
BEGIN
  IF p_phone IS NULL THEN RETURN NULL; END IF;
  v := regexp_replace(p_phone, '\D', '', 'g');
  IF v = '' THEN RETURN NULL; END IF;

  -- Remove DDI 55 quando tamanho 12 ou 13 e começa com 55
  IF length(v) IN (12, 13) AND left(v, 2) = '55' THEN
    v := substring(v from 3);
  END IF;

  -- Aceita apenas 10 (fixo) ou 11 (celular) dígitos
  IF length(v) NOT IN (10, 11) THEN
    RETURN NULL;
  END IF;

  v_ddd := substring(v from 1 for 2);
  IF v_ddd::int < 11 OR v_ddd::int > 99 THEN
    RETURN NULL;
  END IF;

  v_rest := substring(v from 3);

  -- Celular: 9 dígitos após DDD começando com 9
  IF length(v_rest) = 9 THEN
    IF left(v_rest, 1) <> '9' THEN
      RETURN NULL; -- 9 dígitos sem começar com 9 é inválido
    END IF;
    RETURN v_ddd || v_rest;
  END IF;

  -- 8 dígitos após DDD: se começa com 9, 8 ou 7, provavelmente é celular sem o 9 -> insere
  IF length(v_rest) = 8 THEN
    IF left(v_rest, 1) IN ('9', '8', '7', '6') THEN
      RETURN v_ddd || '9' || v_rest;
    END IF;
    -- Fixo (começa 2-5): mantém 10 dígitos
    RETURN v_ddd || v_rest;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_br_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_br_phone(text) TO anon, authenticated, service_role;

-- 2) Validação: usa telefone normalizado antes do hash
CREATE OR REPLACE FUNCTION public.validar_identidade_duplicada(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cpf text; v_tel_raw text; v_tel text; v_email text;
  v_cpf_hash text; v_tel_hash text;
BEGIN
  SELECT regexp_replace(COALESCE(cpf,''), '\D', '', 'g'),
         COALESCE(telefone,'')
    INTO v_cpf, v_tel_raw FROM public.profiles WHERE id = p_profile_id;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_profile_id;

  v_tel := public.normalize_br_phone(v_tel_raw);

  v_cpf_hash := CASE WHEN v_cpf = '' THEN NULL ELSE encode(extensions.digest(v_cpf, 'sha256'), 'hex') END;
  v_tel_hash := CASE WHEN v_tel IS NULL OR v_tel = '' THEN NULL ELSE encode(extensions.digest(v_tel, 'sha256'), 'hex') END;

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

-- 3) Registro: usa telefone normalizado antes do hash
CREATE OR REPLACE FUNCTION public.registrar_identidade_usada(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_cpf text; v_tel_raw text; v_tel text; v_email text;
  v_cpf_hash text; v_tel_hash text;
BEGIN
  SELECT regexp_replace(COALESCE(cpf,''), '\D', '', 'g'),
         COALESCE(telefone,'')
    INTO v_cpf, v_tel_raw FROM public.profiles WHERE id = p_profile_id;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_profile_id;

  v_tel := public.normalize_br_phone(v_tel_raw);

  v_cpf_hash := CASE WHEN v_cpf = '' THEN NULL ELSE encode(extensions.digest(v_cpf, 'sha256'), 'hex') END;
  v_tel_hash := CASE WHEN v_tel IS NULL OR v_tel = '' THEN NULL ELSE encode(extensions.digest(v_tel, 'sha256'), 'hex') END;

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

-- 4) Trigger em profiles: normaliza telefone antes de gravar
CREATE OR REPLACE FUNCTION public.trg_normalize_profile_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
BEGIN
  IF NEW.telefone IS NOT NULL AND NEW.telefone <> '' THEN
    v_norm := public.normalize_br_phone(NEW.telefone);
    IF v_norm IS NOT NULL THEN
      NEW.telefone := v_norm;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_normalize_profile_phone ON public.profiles;
CREATE TRIGGER trg_normalize_profile_phone
BEFORE INSERT OR UPDATE OF telefone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_profile_phone();

-- 5) Backfill: normaliza telefones existentes em profiles
UPDATE public.profiles
   SET telefone = public.normalize_br_phone(telefone)
 WHERE telefone IS NOT NULL
   AND telefone <> ''
   AND public.normalize_br_phone(telefone) IS NOT NULL
   AND public.normalize_br_phone(telefone) <> telefone;

-- 6) Reprocessa hashes de identidades_usadas com base no telefone normalizado atual
-- Remove entradas de telefone órfãs (sem profile vinculado ou com profile sem telefone válido)
-- e re-registra a partir do estado atual dos profiles.
DO $$
DECLARE
  r record;
  v_new_hash text;
BEGIN
  FOR r IN
    SELECT iu.id, iu.telefone_hash, iu.primeiro_profile_id, p.telefone
      FROM public.identidades_usadas iu
      LEFT JOIN public.profiles p ON p.id = iu.primeiro_profile_id
     WHERE iu.telefone_hash IS NOT NULL
  LOOP
    IF r.telefone IS NULL OR r.telefone = '' OR public.normalize_br_phone(r.telefone) IS NULL THEN
      -- Sem base confiável para recomputar; limpa telefone_hash (mantém demais colunas)
      UPDATE public.identidades_usadas SET telefone_hash = NULL WHERE id = r.id;
    ELSE
      v_new_hash := encode(extensions.digest(public.normalize_br_phone(r.telefone), 'sha256'), 'hex');
      IF v_new_hash <> r.telefone_hash THEN
        -- Evita colisão: se já existe outra linha com esse hash, remove a atual e deixa a existente
        IF EXISTS (SELECT 1 FROM public.identidades_usadas WHERE telefone_hash = v_new_hash AND id <> r.id) THEN
          UPDATE public.identidades_usadas SET telefone_hash = NULL WHERE id = r.id;
        ELSE
          UPDATE public.identidades_usadas SET telefone_hash = v_new_hash WHERE id = r.id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;