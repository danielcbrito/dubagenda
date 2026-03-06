-- Create the missing service for "plano teste" and link it
DO $$
DECLARE
  v_servico_id uuid;
BEGIN
  INSERT INTO public.servicos (nome, preco, duracao_minutos, tenant_id, ativo)
  VALUES ('plano teste', 50.00, 30, 'c5897247-6ee4-47e7-bade-7f46868e10d7', true)
  RETURNING id INTO v_servico_id;

  UPDATE public.planos
  SET servico_id = v_servico_id, updated_at = now()
  WHERE id = 'ed5b6126-09d1-4e98-9a24-65c37605e665';
END;
$$;

-- Also add a NOT NULL constraint to prevent this from happening again
-- First ensure no other plans have null servico_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM planos WHERE servico_id IS NULL AND ativo = true) THEN
    RAISE EXCEPTION 'There are still plans with null servico_id';
  END IF;
END;
$$;