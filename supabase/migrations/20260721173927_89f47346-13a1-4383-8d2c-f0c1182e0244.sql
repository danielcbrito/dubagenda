-- Remove overload antiga (2 args) de registrar_indicacao.
-- Frontend (CompletarPerfil.tsx e Auth.tsx) usa sempre a versão nova (3 args: p_indicado_id, p_codigo, p_session_id).
-- A versão antiga tinha LIMITE_MENSAL=10 hardcoded, conflitando com a nova (LIMITE_MENSAL=4).
DROP FUNCTION IF EXISTS public.registrar_indicacao(uuid, text);

-- Confirma que sobrou apenas uma versão
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_indicacao';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Esperado 1 registrar_indicacao, encontrado %', v_count;
  END IF;
END $$;