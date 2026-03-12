
-- Drop the client SELECT policy that lacks visivel_para_usuario filter
DROP POLICY IF EXISTS "Users can view own appointments" ON agendamentos;

-- Recreate with visibility filter for clients only
CREATE POLICY "Users can view own appointments"
ON agendamentos FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND visivel_para_usuario = true
);
