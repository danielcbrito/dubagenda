-- Delete all data related to "Barbearia Silva" tenants (correct dependency order)

-- 0. Pontos referencing promotions
DELETE FROM public.pontos WHERE promocao_id IN (
  SELECT id FROM public.promocoes WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d')
);

-- 1. Discount coupon redemptions
DELETE FROM public.discount_coupon_redemptions WHERE coupon_id IN (
  SELECT id FROM public.discount_coupons WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d')
);

-- 2. Discount coupons
DELETE FROM public.discount_coupons WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d');

-- 3. Promoções
DELETE FROM public.promocoes WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d');

-- 4. Planos ANTES dos serviços (planos referenciam servicos)
DELETE FROM public.planos WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d');

-- 5. Serviços
DELETE FROM public.servicos WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d');

-- 6. Tenant assinaturas
DELETE FROM public.tenant_assinaturas WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d');

-- 7. Tenant clientes
DELETE FROM public.tenant_clientes WHERE tenant_id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d');

-- 8. User roles (tenant_admin) for owners
DELETE FROM public.user_roles WHERE user_id IN ('6dffbe7e-9a53-4138-ab72-ec6b3f9b0c25', '6b047c7e-e2a7-497e-96ac-2a571e721817') AND role = 'tenant_admin';

-- 9. Delete the tenants
DELETE FROM public.tenants WHERE id IN ('c5897247-6ee4-47e7-bade-7f46868e10d7', '37cdf7b9-7c51-4cab-9e47-ec9d3bcf7a2d');