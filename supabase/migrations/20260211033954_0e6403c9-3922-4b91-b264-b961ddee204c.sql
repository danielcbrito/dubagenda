-- Limpar assinaturas "suspended" que nunca foram pagas (tentativas falhas de pagamento por cartão)
-- Estas foram criadas pelo fluxo de assinatura quando o cartão foi recusado
DELETE FROM assinaturas 
WHERE status = 'suspended' 
AND payment_method = 'card';