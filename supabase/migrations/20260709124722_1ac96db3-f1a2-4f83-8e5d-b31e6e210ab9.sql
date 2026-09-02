
-- =========================================================
-- 1. gerar_referral_code
-- =========================================================
CREATE OR REPLACE FUNCTION public.gerar_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sem 0/O/1/I/L
  code text;
  i int;
  tentativa int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    tentativa := tentativa + 1;
    IF tentativa >= 10 THEN
      RAISE EXCEPTION 'Nao foi possivel gerar referral_code unico apos 10 tentativas';
    END IF;
  END LOOP;
END;
$$;

-- =========================================================
-- 2. handle_new_user (adiciona geração do referral_code)
--    Todos os perfis recebem código; a trava "só cliente pode indicar"
--    é aplicada no frontend + policies das telas de indicação.
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    public.gerar_referral_code()
  )
  ON CONFLICT (id) DO UPDATE
    SET referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code);
  RETURN NEW;
END;
$$;

-- Backfill: garantir código para perfis existentes
UPDATE public.profiles SET referral_code = public.gerar_referral_code() WHERE referral_code IS NULL;

-- =========================================================
-- 3. registrar_identidade_usada
-- =========================================================
CREATE OR REPLACE FUNCTION public.registrar_identidade_usada(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text;
  v_tel text;
  v_email text;
  v_cpf_hash text;
  v_tel_hash text;
BEGIN
  SELECT regexp_replace(COALESCE(cpf,''), '\D', '', 'g'),
         regexp_replace(COALESCE(telefone,''), '\D', '', 'g')
    INTO v_cpf, v_tel
  FROM public.profiles WHERE id = p_profile_id;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_profile_id;

  v_cpf_hash := CASE WHEN v_cpf = '' THEN NULL ELSE encode(digest(v_cpf, 'sha256'), 'hex') END;
  v_tel_hash := CASE WHEN v_tel = '' THEN NULL ELSE encode(digest(v_tel, 'sha256'), 'hex') END;

  IF v_cpf_hash IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.identidades_usadas WHERE cpf_hash = v_cpf_hash) THEN
    INSERT INTO public.identidades_usadas (cpf_hash, primeiro_profile_id) VALUES (v_cpf_hash, p_profile_id)
    ON CONFLICT (cpf_hash) DO NOTHING;
  END IF;

  IF v_tel_hash IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.identidades_usadas WHERE telefone_hash = v_tel_hash) THEN
    INSERT INTO public.identidades_usadas (telefone_hash, primeiro_profile_id) VALUES (v_tel_hash, p_profile_id)
    ON CONFLICT (telefone_hash) DO NOTHING;
  END IF;

  IF v_email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.identidades_usadas WHERE email = v_email) THEN
    INSERT INTO public.identidades_usadas (email, primeiro_profile_id) VALUES (v_email, p_profile_id)
    ON CONFLICT (email) DO NOTHING;
  END IF;
END;
$$;

-- Trigger em profiles para capturar CPF/telefone quando preenchidos ou alterados
CREATE OR REPLACE FUNCTION public.trg_registrar_identidade_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND (NEW.cpf IS NOT NULL OR NEW.telefone IS NOT NULL))
     OR (TG_OP = 'UPDATE' AND (COALESCE(NEW.cpf,'') IS DISTINCT FROM COALESCE(OLD.cpf,'')
                            OR COALESCE(NEW.telefone,'') IS DISTINCT FROM COALESCE(OLD.telefone,''))) THEN
    PERFORM public.registrar_identidade_usada(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_identidade_profile ON public.profiles;
CREATE TRIGGER trg_registrar_identidade_profile
AFTER INSERT OR UPDATE OF cpf, telefone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_registrar_identidade_profile();

-- Trigger em auth.users para registrar email na criação
CREATE OR REPLACE FUNCTION public.trg_registrar_identidade_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.registrar_identidade_usada(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_identidade_email ON auth.users;
-- Nota: NÃO criamos trigger em auth.users (schema protegido). O registro do email
-- será feito via edge function ou via chamada RPC após signup. A função continua disponível.

-- =========================================================
-- 4. validar_identidade_duplicada
-- =========================================================
CREATE OR REPLACE FUNCTION public.validar_identidade_duplicada(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text; v_tel text; v_email text;
  v_cpf_hash text; v_tel_hash text;
BEGIN
  SELECT regexp_replace(COALESCE(cpf,''), '\D', '', 'g'),
         regexp_replace(COALESCE(telefone,''), '\D', '', 'g')
    INTO v_cpf, v_tel
  FROM public.profiles WHERE id = p_profile_id;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_profile_id;

  v_cpf_hash := CASE WHEN v_cpf = '' THEN NULL ELSE encode(digest(v_cpf, 'sha256'), 'hex') END;
  v_tel_hash := CASE WHEN v_tel = '' THEN NULL ELSE encode(digest(v_tel, 'sha256'), 'hex') END;

  RETURN EXISTS (
    SELECT 1 FROM public.identidades_usadas
    WHERE primeiro_profile_id IS DISTINCT FROM p_profile_id
      AND ( (v_cpf_hash IS NOT NULL AND cpf_hash = v_cpf_hash)
         OR (v_tel_hash IS NOT NULL AND telefone_hash = v_tel_hash)
         OR (v_email IS NOT NULL AND email = v_email) )
  );
END;
$$;

-- =========================================================
-- 5. registrar_indicacao
-- =========================================================
-- LIMITE_MENSAL: para alterar, mudar a constante abaixo (10)
CREATE OR REPLACE FUNCTION public.registrar_indicacao(p_indicado_id uuid, p_codigo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicador_id uuid;
  v_indicacao_id uuid;
  v_count int;
  v_duplicada boolean;
  LIMITE_MENSAL constant int := 10;
BEGIN
  IF p_codigo IS NULL OR length(trim(p_codigo)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_indicador_id FROM public.profiles WHERE referral_code = upper(trim(p_codigo));
  IF v_indicador_id IS NULL THEN RETURN NULL; END IF;

  IF v_indicador_id = p_indicado_id THEN
    RAISE WARNING 'Tentativa de autoindicacao detectada para profile %', p_indicado_id;
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.indicacoes WHERE indicado_id = p_indicado_id) THEN
    RETURN NULL; -- já indicado antes
  END IF;

  v_duplicada := public.validar_identidade_duplicada(p_indicado_id);

  IF v_duplicada THEN
    INSERT INTO public.indicacoes (indicador_id, indicado_id, codigo_usado, status, motivo_invalidacao)
    VALUES (v_indicador_id, p_indicado_id, upper(trim(p_codigo)), 'invalidado',
            'Identidade (CPF/telefone/email) ja utilizada em outra conta')
    RETURNING id INTO v_indicacao_id;
    RETURN v_indicacao_id;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.indicacoes
  WHERE indicador_id = v_indicador_id
    AND status <> 'invalidado'
    AND criado_em > now() - interval '30 days';

  IF v_count >= LIMITE_MENSAL THEN
    INSERT INTO public.indicacoes (indicador_id, indicado_id, codigo_usado, status, motivo_invalidacao)
    VALUES (v_indicador_id, p_indicado_id, upper(trim(p_codigo)), 'invalidado',
            'Limite mensal de indicacoes atingido')
    RETURNING id INTO v_indicacao_id;
    RETURN v_indicacao_id;
  END IF;

  INSERT INTO public.indicacoes (indicador_id, indicado_id, codigo_usado, status)
  VALUES (v_indicador_id, p_indicado_id, upper(trim(p_codigo)), 'pendente')
  RETURNING id INTO v_indicacao_id;

  UPDATE public.profiles SET referred_by = v_indicador_id WHERE id = p_indicado_id;

  RETURN v_indicacao_id;
EXCEPTION WHEN unique_violation THEN
  RETURN NULL;
END;
$$;

-- =========================================================
-- 7. Trigger: primeiro agendamento marca indicacao como 'agendado'
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_indicacao_agendamento_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.indicacoes
  SET status = 'agendado',
      agendamento_qualificador_id = NEW.id,
      agendado_em = now()
  WHERE indicado_id = NEW.user_id
    AND status = 'pendente'
    AND agendamento_qualificador_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_indicacao_agendamento_criado ON public.agendamentos;
CREATE TRIGGER trg_indicacao_agendamento_criado
AFTER INSERT ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_indicacao_agendamento_criado();

-- =========================================================
-- 8. Trigger: agendamento 'completed' libera credito
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_indicacao_agendamento_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicacao_id uuid;
  v_indicador_id uuid;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT id, indicador_id INTO v_indicacao_id, v_indicador_id
    FROM public.indicacoes
    WHERE agendamento_qualificador_id = NEW.id
      AND status = 'agendado'
    LIMIT 1;

    IF v_indicacao_id IS NULL THEN
      RETURN NEW;
    END IF;

    UPDATE public.indicacoes
    SET status = 'confirmado', confirmado_em = now()
    WHERE id = v_indicacao_id;

    INSERT INTO public.creditos_indicacao (user_id, indicacao_id, status)
    VALUES (v_indicador_id, v_indicacao_id, 'disponivel');

    UPDATE public.indicacoes
    SET status = 'liberado', liberado_em = now()
    WHERE id = v_indicacao_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao liberar credito de indicacao para agendamento %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_indicacao_agendamento_completed ON public.agendamentos;
CREATE TRIGGER trg_indicacao_agendamento_completed
AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_indicacao_agendamento_completed();

-- =========================================================
-- 9. consumir_credito_indicacao
-- =========================================================
CREATE OR REPLACE FUNCTION public.consumir_credito_indicacao(p_agendamento_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credito_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_credito_id
  FROM public.creditos_indicacao
  WHERE user_id = auth.uid() AND status = 'disponivel'
  ORDER BY criado_em ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_credito_id IS NULL THEN RETURN false; END IF;

  UPDATE public.creditos_indicacao
  SET status = 'usado', usado_em = now(), usado_no_agendamento_id = p_agendamento_id
  WHERE id = v_credito_id;

  RETURN true;
END;
$$;

-- Grants (mínimo necessário; internas ficam sem grant público)
REVOKE ALL ON FUNCTION public.gerar_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_identidade_usada(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_indicacao(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validar_identidade_duplicada(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consumir_credito_indicacao(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.registrar_indicacao(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validar_identidade_duplicada(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consumir_credito_indicacao(uuid) TO authenticated;
