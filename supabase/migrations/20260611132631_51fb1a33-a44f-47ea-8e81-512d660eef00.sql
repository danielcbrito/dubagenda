CREATE OR REPLACE FUNCTION public.auto_create_agendamento_from_plano_uso()
RETURNS TRIGGER AS $$
DECLARE
  v_servico_id UUID;
  v_barbeiro_id UUID;
  v_tenant_id UUID;
  v_new_agendamento_id UUID;
  v_data DATE;
  v_hora TIME;
BEGIN
  -- Se já tem um agendamento_id, não faz nada
  IF NEW.agendamento_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Busca o servico_id vinculado ao plano da assinatura
  SELECT p.servico_id INTO v_servico_id
  FROM public.assinaturas a
  JOIN public.planos p ON a.plano_id = p.id
  WHERE a.id = NEW.assinatura_id;

  -- Busca a barbearia preferida do usuário para definir o tenant_id
  -- E tenta pegar o primeiro barbeiro dessa barbearia (como fallback)
  -- NOTA: O ideal seria que o barbeiro que fez o registro passasse o seu ID, 
  -- mas como estamos automatizando no nível de banco para registros manuais, 
  -- vamos buscar o barbeiro padrão ou o primeiro da barbearia vinculada ao plano/cliente.
  
  SELECT b.id INTO v_barbeiro_id
  FROM public.barbeiros b
  JOIN public.profiles pr ON pr.barbearia_preferida_id = b.tenant_id
  WHERE pr.id = NEW.user_id
  LIMIT 1;

  -- Define data e hora baseadas no momento da criação do uso
  v_data := NEW.created_at::DATE;
  v_hora := NEW.created_at::TIME;

  -- Cria o agendamento
  INSERT INTO public.agendamentos (
    user_id,
    barbeiro_id,
    servico_id,
    data,
    hora,
    status,
    payment_method,
    tipo_agendamento,
    visivel_para_usuario,
    preco,
    duracao,
    cliente_confirmou,
    barbeiro_confirmou,
    ponto_liberado
  ) VALUES (
    NEW.user_id,
    v_barbeiro_id,
    v_servico_id,
    v_data,
    v_hora,
    'completed',
    'plano',
    'plano',
    true,
    0,
    30, -- Duração padrão
    true,
    true,
    true
  ) RETURNING id INTO v_new_agendamento_id;

  -- Vincula o novo agendamento ao registro de uso
  NEW.agendamento_id := v_new_agendamento_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger na tabela plano_agendamentos_usos
DROP TRIGGER IF EXISTS trg_auto_create_agendamento_from_plano_uso ON public.plano_agendamentos_usos;
CREATE TRIGGER trg_auto_create_agendamento_from_plano_uso
BEFORE INSERT ON public.plano_agendamentos_usos
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_agendamento_from_plano_uso();