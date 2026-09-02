
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. identidades_usadas
CREATE TABLE public.identidades_usadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_hash text UNIQUE,
  telefone_hash text UNIQUE,
  email text UNIQUE,
  primeiro_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.identidades_usadas TO service_role;
ALTER TABLE public.identidades_usadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block all direct access" ON public.identidades_usadas
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- 2. indicacoes
CREATE TABLE public.indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  indicado_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  codigo_usado text NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','agendado','confirmado','liberado','invalidado','expirado')),
  agendamento_qualificador_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  motivo_invalidacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  agendado_em timestamptz,
  confirmado_em timestamptz,
  liberado_em timestamptz,
  CONSTRAINT indicacoes_indicado_unique UNIQUE (indicado_id),
  CONSTRAINT indicacoes_no_self CHECK (indicador_id <> indicado_id)
);
GRANT SELECT ON public.indicacoes TO authenticated;
GRANT ALL ON public.indicacoes TO service_role;
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ve suas indicacoes" ON public.indicacoes
  FOR SELECT TO authenticated
  USING (indicador_id = auth.uid() OR indicado_id = auth.uid());

CREATE POLICY "Admin ve todas indicacoes" ON public.indicacoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'barber'));

-- 3. creditos_indicacao
CREATE TABLE public.creditos_indicacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  indicacao_id uuid NOT NULL REFERENCES public.indicacoes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disponivel'
    CHECK (status IN ('disponivel','usado','expirado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz,
  usado_no_agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  CONSTRAINT creditos_indicacao_unique UNIQUE (indicacao_id)
);
GRANT SELECT ON public.creditos_indicacao TO authenticated;
GRANT ALL ON public.creditos_indicacao TO service_role;
ALTER TABLE public.creditos_indicacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cliente ve seus creditos" ON public.creditos_indicacao
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin ve todos creditos" ON public.creditos_indicacao
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'barber'));

-- 4. Novas colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
