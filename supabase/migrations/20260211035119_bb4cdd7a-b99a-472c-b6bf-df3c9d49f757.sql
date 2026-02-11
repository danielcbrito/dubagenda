-- Limpar assinaturas que nunca foram ativas (suspended -> cancelled) 
-- Estas são tentativas de assinatura que não foram finalizadas
-- e não devem gerar banner de "plano expirado"
DELETE FROM assinaturas 
WHERE status = 'cancelled' 
AND user_id = 'df8bc0ce-6963-4d3e-9ed6-7ff32d09c0c1'
AND id = 'ad6c229d-d2ea-4da9-abfa-7fba53c4e824';