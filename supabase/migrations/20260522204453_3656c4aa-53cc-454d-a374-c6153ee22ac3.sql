-- Identificar o usuário Daniel Brito
-- ID: df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1
-- Promoção ativa: bf03dabc-cee6-46df-ae78-b6a4f4f82954 (Plano Fidelidade)

-- 1. Marcar resgates expirados como 'expired' para limpeza
UPDATE public.resgates
SET status = 'expired'
WHERE user_id = 'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1'
  AND status = 'available'
  AND expired_at < NOW();

-- 2. Atualizar ou inserir pontos (resetar para 0 pois o prêmio será concedido)
INSERT INTO public.pontos (user_id, pontos, promocao_id, last_awarded_at, updated_at)
VALUES ('df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1', 0, 'bf03dabc-cee6-46df-ae78-b6a4f4f82954', NOW(), NOW())
ON CONFLICT (user_id)
DO UPDATE SET
  pontos = 0,
  promocao_id = 'bf03dabc-cee6-46df-ae78-b6a4f4f82954',
  updated_at = NOW();

-- 3. Inserir o novo resgate (corte grátis)
INSERT INTO public.resgates (user_id, promocao_id, status, created_at, expired_at)
VALUES (
  'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1',
  'bf03dabc-cee6-46df-ae78-b6a4f4f82954',
  'available',
  NOW(),
  NOW() + INTERVAL '90 days'
);