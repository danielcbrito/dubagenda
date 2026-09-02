
-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "View plans" ON public.planos;

-- Create a new policy that allows any authenticated user to see active plans
CREATE POLICY "Anyone can view active plans"
ON public.planos
FOR SELECT
USING (ativo = true);
