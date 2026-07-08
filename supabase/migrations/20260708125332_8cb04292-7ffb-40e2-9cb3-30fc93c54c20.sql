-- Restore Data API grants on public schema. RLS policies still enforce row-level access.
-- Grant to authenticated on all base tables
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.relname);
  END LOOP;
END $$;

-- Anon reads only on tables the app exposes publicly (discover/landing)
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT ON public.tenant_unidades TO anon;
GRANT SELECT ON public.barbeiros TO anon;
GRANT SELECT ON public.servicos TO anon;
GRANT SELECT ON public.barbeiro_portfolio TO anon;
GRANT SELECT ON public.portfolio_images TO anon;
GRANT SELECT ON public.barbeiro_avaliacoes TO anon;
GRANT SELECT ON public.barbeiro_unidades TO anon;
GRANT SELECT ON public.planos TO anon;
GRANT SELECT ON public.plano_servicos TO anon;
GRANT SELECT ON public.produtos_loja TO anon;
GRANT SELECT ON public.produto_imagens TO anon;
GRANT SELECT ON public.categorias TO anon;
GRANT SELECT ON public.informacoes_empresa TO anon;
GRANT SELECT ON public.informacoes_aplicativo TO anon;
GRANT SELECT ON public.anuncios_app TO anon;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;