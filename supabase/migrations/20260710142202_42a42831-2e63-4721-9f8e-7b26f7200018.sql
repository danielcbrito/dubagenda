
CREATE OR REPLACE FUNCTION public.get_meus_indicados_info()
RETURNS TABLE(id uuid, nome text, email text, telefone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, u.email::text, p.telefone
  FROM public.indicacoes i
  JOIN public.profiles p ON p.id = i.indicado_id
  LEFT JOIN auth.users u ON u.id = i.indicado_id
  WHERE i.indicador_id = auth.uid()
    AND i.indicado_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_meus_indicados_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meus_indicados_info() TO authenticated;
