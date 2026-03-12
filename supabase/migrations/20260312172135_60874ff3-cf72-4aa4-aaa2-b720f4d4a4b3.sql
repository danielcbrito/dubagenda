-- 1. taxas_gateway: restringir leitura a admin e tenant_admin
DROP POLICY IF EXISTS "Authenticated users can read taxas" ON taxas_gateway;

CREATE POLICY "Admin and tenant admin can read taxas"
ON taxas_gateway FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'tenant_admin'::app_role)
);

-- 2. financeiro_marco_zero: restringir leitura a admin
DROP POLICY IF EXISTS "Admins podem ver marco zero" ON financeiro_marco_zero;

CREATE POLICY "Only admins can read marco zero"
ON financeiro_marco_zero FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);