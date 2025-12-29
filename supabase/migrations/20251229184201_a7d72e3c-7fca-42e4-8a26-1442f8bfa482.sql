-- Adicionar política de DELETE para que admins possam excluir relatórios
CREATE POLICY "Admins can delete reports" 
ON public.relatorios_mensais 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));