
-- Backfill: cria unidade sede para tenants ativos sem unidade, usando endereço da tenants
INSERT INTO public.tenant_unidades (tenant_id, nome, slug, rua, numero, bairro, cidade, estado, is_sede, ativo)
SELECT t.id, t.nome, t.slug, t.rua, t.numero, t.bairro, t.cidade, t.estado, true, true
FROM public.tenants t
WHERE t.ativo = true
  AND t.onboarding_completed = true
  AND COALESCE(t.cidade,'') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.tenant_unidades u WHERE u.tenant_id = t.id);

-- Trigger: garante unidade sede automaticamente ao completar o onboarding
CREATE OR REPLACE FUNCTION public.ensure_tenant_sede_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ativo = true
     AND NEW.onboarding_completed = true
     AND COALESCE(NEW.cidade,'') <> ''
     AND NOT EXISTS (SELECT 1 FROM public.tenant_unidades u WHERE u.tenant_id = NEW.id)
  THEN
    INSERT INTO public.tenant_unidades (
      tenant_id, nome, slug, rua, numero, bairro, cidade, estado, is_sede, ativo
    ) VALUES (
      NEW.id, NEW.nome, NEW.slug, NEW.rua, NEW.numero, NEW.bairro, NEW.cidade, NEW.estado, true, true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_tenant_sede_unit ON public.tenants;
CREATE TRIGGER trg_ensure_tenant_sede_unit
AFTER INSERT OR UPDATE OF ativo, onboarding_completed, cidade, rua, numero, bairro, estado
ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.ensure_tenant_sede_unit();
