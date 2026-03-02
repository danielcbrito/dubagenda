
-- Add slug column to tenants for clean public URLs
-- Column already added by previous partial migration, so use IF NOT EXISTS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'slug') THEN
    ALTER TABLE public.tenants ADD COLUMN slug text;
  END IF;
END $$;

-- Drop the partially created function/trigger if they exist
DROP TRIGGER IF EXISTS trg_tenants_auto_slug ON public.tenants;
DROP FUNCTION IF EXISTS public.auto_generate_tenant_slug();
DROP FUNCTION IF EXISTS public.generate_tenant_slug(text);

-- Function to generate slug from name (without unaccent)
CREATE OR REPLACE FUNCTION public.generate_tenant_slug(tenant_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  base_slug := lower(tenant_name);
  -- Manual accent removal for Portuguese
  base_slug := translate(base_slug, 
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
    'aaaaaaeeeeiiiioooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC');
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(trim(base_slug), '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  IF base_slug = '' THEN
    base_slug := 'barbearia';
  END IF;
  
  final_slug := base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Auto-generate slugs for existing tenants
UPDATE public.tenants
SET slug = public.generate_tenant_slug(nome)
WHERE slug IS NULL;

-- Add unique constraint now that all slugs are populated
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tenants_slug_unique') THEN
    CREATE UNIQUE INDEX idx_tenants_slug_unique ON public.tenants (slug) WHERE slug IS NOT NULL;
  END IF;
END $$;

-- Trigger to auto-generate slug on insert
CREATE OR REPLACE FUNCTION public.auto_generate_tenant_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_tenant_slug(NEW.nome);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tenants_auto_slug
  BEFORE INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_tenant_slug();

-- Allow public (anon) access to active tenants for invite links
CREATE POLICY "Public can view active tenants by slug"
  ON public.tenants
  FOR SELECT
  TO anon
  USING (ativo = true AND onboarding_completed = true AND slug IS NOT NULL);
