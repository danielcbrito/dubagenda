-- =====================================================
-- SISTEMA MULTI-BARBEIROS COMPLETO
-- =====================================================

-- 1. Expandir tabela barbeiros com campos necessários
ALTER TABLE public.barbeiros
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS foto_url TEXT,
ADD COLUMN IF NOT EXISTS google_client_id TEXT,
ADD COLUMN IF NOT EXISTS google_client_secret TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Criar tabela de horários individuais por barbeiro
CREATE TABLE IF NOT EXISTS public.configuracoes_horario_barbeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbeiro_id UUID NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  aberto BOOLEAN DEFAULT true,
  hora_abertura TEXT DEFAULT '09:00',
  hora_fechamento TEXT DEFAULT '18:00',
  hora_almoco_inicio TEXT,
  hora_almoco_fim TEXT,
  delay_entre_servicos INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(barbeiro_id, dia_semana)
);

-- 3. Criar tabela de horários excepcionais por barbeiro
CREATE TABLE IF NOT EXISTS public.horarios_excepcionais_barbeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barbeiro_id UUID NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  aberto BOOLEAN DEFAULT false,
  hora_abertura TEXT,
  hora_fechamento TEXT,
  hora_almoco_inicio TEXT,
  hora_almoco_fim TEXT,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(barbeiro_id, data)
);

-- 4. Enable RLS on new tables
ALTER TABLE public.configuracoes_horario_barbeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_excepcionais_barbeiro ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies para configuracoes_horario_barbeiro

-- Admin pode ver tudo
CREATE POLICY "Admin can view all barber hours"
ON public.configuracoes_horario_barbeiro
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin pode inserir/atualizar/deletar
CREATE POLICY "Admin can manage all barber hours"
ON public.configuracoes_horario_barbeiro
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Barbeiro pode ver/editar seus próprios horários
CREATE POLICY "Barber can view own hours"
ON public.configuracoes_horario_barbeiro
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbeiros b
    WHERE b.id = configuracoes_horario_barbeiro.barbeiro_id
    AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Barber can manage own hours"
ON public.configuracoes_horario_barbeiro
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbeiros b
    WHERE b.id = configuracoes_horario_barbeiro.barbeiro_id
    AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barbeiros b
    WHERE b.id = configuracoes_horario_barbeiro.barbeiro_id
    AND b.user_id = auth.uid()
  )
);

-- Clientes podem ver horários (para agendamento)
CREATE POLICY "Clients can view barber hours"
ON public.configuracoes_horario_barbeiro
FOR SELECT
TO authenticated
USING (true);

-- 6. RLS Policies para horarios_excepcionais_barbeiro
CREATE POLICY "Admin can view all exceptional hours"
ON public.horarios_excepcionais_barbeiro
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage all exceptional hours"
ON public.horarios_excepcionais_barbeiro
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Barber can view own exceptional hours"
ON public.horarios_excepcionais_barbeiro
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbeiros b
    WHERE b.id = horarios_excepcionais_barbeiro.barbeiro_id
    AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Barber can manage own exceptional hours"
ON public.horarios_excepcionais_barbeiro
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.barbeiros b
    WHERE b.id = horarios_excepcionais_barbeiro.barbeiro_id
    AND b.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.barbeiros b
    WHERE b.id = horarios_excepcionais_barbeiro.barbeiro_id
    AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view exceptional hours"
ON public.horarios_excepcionais_barbeiro
FOR SELECT
TO authenticated
USING (true);

-- 7. Atualizar RLS da tabela barbeiros para barbeiros verem seus dados
CREATE POLICY "Barber can view own profile"
ON public.barbeiros
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Barber can update own profile"
ON public.barbeiros
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 8. Função para criar barbeiro e associar role
CREATE OR REPLACE FUNCTION public.create_barber_with_user(
  p_email TEXT,
  p_password TEXT,
  p_nome TEXT,
  p_telefone TEXT,
  p_apelido TEXT,
  p_comissao_pct NUMERIC DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_barber_id UUID;
BEGIN
  -- Verificar se quem está chamando é admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem criar barbeiros');
  END IF;

  -- Criar o usuário via auth (isso será feito via edge function)
  -- Por enquanto, apenas retornar os dados para a edge function processar
  RETURN jsonb_build_object(
    'success', true,
    'email', p_email,
    'password', p_password,
    'nome', p_nome,
    'telefone', p_telefone,
    'apelido', p_apelido,
    'comissao_pct', p_comissao_pct
  );
END;
$$;

-- 9. Função para inicializar horários padrão do barbeiro
CREATE OR REPLACE FUNCTION public.initialize_barber_hours(p_barbeiro_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir configurações padrão para cada dia da semana (0-6)
  INSERT INTO public.configuracoes_horario_barbeiro (barbeiro_id, dia_semana, aberto, hora_abertura, hora_fechamento, hora_almoco_inicio, hora_almoco_fim)
  SELECT 
    p_barbeiro_id,
    dia,
    CASE WHEN dia IN (0, 6) THEN false ELSE true END, -- Fechado sábado e domingo por padrão
    '09:00',
    '18:00',
    '12:00',
    '13:00'
  FROM generate_series(0, 6) AS dia
  ON CONFLICT (barbeiro_id, dia_semana) DO NOTHING;
END;
$$;

-- 10. Trigger para inicializar horários quando barbeiro é criado
CREATE OR REPLACE FUNCTION public.on_barber_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.initialize_barber_hours(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_init_barber_hours ON public.barbeiros;
CREATE TRIGGER trigger_init_barber_hours
  AFTER INSERT ON public.barbeiros
  FOR EACH ROW
  EXECUTE FUNCTION public.on_barber_created();

-- 11. RLS policy para agendamentos - barbeiro pode ver/editar seus próprios
CREATE POLICY "Barber can view own appointments"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (
  barbeiro_id IN (
    SELECT id FROM public.barbeiros WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Barber can update own appointments"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (
  barbeiro_id IN (
    SELECT id FROM public.barbeiros WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  barbeiro_id IN (
    SELECT id FROM public.barbeiros WHERE user_id = auth.uid()
  )
);

-- 12. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_barbeiros_user_id ON public.barbeiros(user_id);
CREATE INDEX IF NOT EXISTS idx_barbeiros_ativo ON public.barbeiros(ativo);
CREATE INDEX IF NOT EXISTS idx_agendamentos_barbeiro_id ON public.agendamentos(barbeiro_id);
CREATE INDEX IF NOT EXISTS idx_config_horario_barbeiro_id ON public.configuracoes_horario_barbeiro(barbeiro_id);
CREATE INDEX IF NOT EXISTS idx_horarios_exc_barbeiro_id ON public.horarios_excepcionais_barbeiro(barbeiro_id);

-- 13. Atualizar trigger handle_new_user para verificar se é barbeiro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barbeiro RECORD;
BEGIN
  -- Criar perfil
  INSERT INTO public.profiles (id, nome, cpf, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.raw_user_meta_data->>'cpf',
    NEW.raw_user_meta_data->>'telefone'
  );
  
  -- Verificar se este email está cadastrado como barbeiro (sem user_id ainda)
  SELECT * INTO v_barbeiro
  FROM public.barbeiros
  WHERE email = NEW.email AND user_id IS NULL;
  
  IF FOUND THEN
    -- Este usuário é um barbeiro! Associar e dar role de barber
    UPDATE public.barbeiros
    SET user_id = NEW.id
    WHERE id = v_barbeiro.id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'barber');
  ELSE
    -- Usuário normal, role de cliente
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente');
  END IF;
  
  RETURN NEW;
END;
$$;