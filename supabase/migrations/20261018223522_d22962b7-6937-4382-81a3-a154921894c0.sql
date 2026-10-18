DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'informacoes_empresa') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.informacoes_empresa;
  END IF;
END $$;