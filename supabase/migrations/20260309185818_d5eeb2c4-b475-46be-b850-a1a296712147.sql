-- Adicionar unidade_id ao barbeiros
ALTER TABLE public.barbeiros
  ADD COLUMN unidade_id uuid REFERENCES public.tenant_unidades(id) ON DELETE SET NULL;

-- Adicionar unidade_preferida_id ao profiles
ALTER TABLE public.profiles
  ADD COLUMN unidade_preferida_id uuid REFERENCES public.tenant_unidades(id) ON DELETE SET NULL;

-- Adicionar unidade_id ao agendamentos
ALTER TABLE public.agendamentos
  ADD COLUMN unidade_id uuid REFERENCES public.tenant_unidades(id) ON DELETE SET NULL;