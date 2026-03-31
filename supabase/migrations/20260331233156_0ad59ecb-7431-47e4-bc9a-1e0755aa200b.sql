
-- Tabela de bloqueios cliente-barbeiro
CREATE TABLE public.bloqueios_cliente_barbeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  barbeiro_id UUID NOT NULL REFERENCES public.barbeiros(id) ON DELETE CASCADE,
  motivo TEXT,
  bloqueado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, barbeiro_id)
);

ALTER TABLE public.bloqueios_cliente_barbeiro ENABLE ROW LEVEL SECURITY;

-- Clientes podem ver seus próprios bloqueios (para filtrar UI)
CREATE POLICY "Clients can view own blocks"
  ON public.bloqueios_cliente_barbeiro
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins podem gerenciar todos os bloqueios
CREATE POLICY "Admins can manage all blocks"
  ON public.bloqueios_cliente_barbeiro
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Função helper: verificar se cliente está bloqueado de um barbeiro
CREATE OR REPLACE FUNCTION public.is_client_blocked_from_barber(p_user_id UUID, p_barbeiro_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bloqueios_cliente_barbeiro
    WHERE user_id = p_user_id AND barbeiro_id = p_barbeiro_id
  )
$$;

-- Função helper: retornar IDs de barbeiros bloqueados para um usuário
CREATE OR REPLACE FUNCTION public.get_blocked_barber_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(array_agg(barbeiro_id), '{}')
  FROM public.bloqueios_cliente_barbeiro
  WHERE user_id = p_user_id
$$;
