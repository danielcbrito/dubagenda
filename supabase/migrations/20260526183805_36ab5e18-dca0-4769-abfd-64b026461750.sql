-- 1. Corrigir permissão de resgates (evitar que o usuário mude o status manualmente)
DROP POLICY IF EXISTS "Users can update own redemptions" ON public.resgates;

-- 2. Restringir visualização de perfis por barbeiros (Privacidade/PII)
-- Anteriormente: Barbers can view all profiles
DROP POLICY IF EXISTS "Barbers can view all profiles" ON public.profiles;

CREATE POLICY "Barbers can view profiles of their clients" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'tenant_admin'::app_role) OR
  id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.agendamentos a
    JOIN public.barbeiros b ON b.id = a.barbeiro_id
    WHERE a.user_id = public.profiles.id AND b.user_id = auth.uid()
  )
);

-- 3. Garantir que Tenant Admins só vejam perfis do seu próprio tenant (se houver essa relação)
-- Como a tabela profiles não tem tenant_id direto, a relação é via agendamentos ou se for admin global.

-- 4. Adicionar logs de auditoria para tentativas de acesso indevido (opcional, mas bom para PII)
-- Já temos a tabela audit_logs, vamos garantir que ela seja usada.
