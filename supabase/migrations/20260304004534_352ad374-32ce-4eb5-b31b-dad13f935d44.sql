
-- Add missing tables to supabase_realtime publication so realtime listeners work
ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_horario;
ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes_horario_barbeiro;
ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios_excepcionais;
ALTER PUBLICATION supabase_realtime ADD TABLE public.horarios_excepcionais_barbeiro;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assinaturas;
