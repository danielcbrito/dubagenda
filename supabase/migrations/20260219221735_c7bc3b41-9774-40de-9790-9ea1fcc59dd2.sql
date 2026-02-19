
-- 1. Criar o agendamento do cliente danieltuning2016@gmail.com (pagou via PIX mas ficou pendente)
INSERT INTO agendamentos (user_id, servico_id, barbeiro_id, data, hora, duracao, preco, status, barbeiro_confirmou, cliente_confirmou, payment_method)
VALUES ('272cdfb7-f51b-48e6-9e5c-31fa6a45191f', '32a57676-8332-4153-8e7e-1d0949041ad8', '767c51a7-7323-4933-8fc5-9a666f6baa7c', '2026-02-19', '19:00:00', 35, 30, 'pending', false, true, 'pix');

-- 2. Registrar pagamento como pago
INSERT INTO pagamentos (user_id, agendamento_id, metodo, valor, gateway_payment_id, status, data_pagamento)
SELECT '272cdfb7-f51b-48e6-9e5c-31fa6a45191f', id, 'pix', 30, 'pay_dfroi7nebeihfq25', 'paid', NOW()
FROM agendamentos 
WHERE user_id = '272cdfb7-f51b-48e6-9e5c-31fa6a45191f' AND data = '2026-02-19' AND hora = '19:00:00' AND barbeiro_id = '767c51a7-7323-4933-8fc5-9a666f6baa7c'
ORDER BY created_at DESC LIMIT 1;

-- 3. Remover o pending_booking
DELETE FROM pending_bookings WHERE id = '71300210-59dc-4c26-9e3b-537cb8fc53d9';
