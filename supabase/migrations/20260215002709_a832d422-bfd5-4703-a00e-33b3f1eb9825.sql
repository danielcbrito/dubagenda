
-- Remove pagamento duplicado (mesmo gateway_payment_id, vinculado ao agendamento duplicado)
DELETE FROM pagamentos WHERE id = '120432d1-b6ce-41a6-b481-c75d8e034a38';

-- Remove agendamento duplicado (pending, criado milissegundos antes do confirmed)
DELETE FROM agendamentos WHERE id = '0fc30553-a57b-4b6a-9fcc-b87ba42d7765';
