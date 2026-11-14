-- ==============================================================================
-- REATIVAR A TAXA DE CANCELAMENTO DE R$ 5,00 PARA O CLIENTE VIP
-- Barbearia VIP Exclusive (Cliente: 661836a7-a45e-4255-9b37-ec137225a706)
-- ==============================================================================

-- 1. Remove registros antigos de débito desse cliente para não duplicar
DELETE FROM public.informacoes_empresa 
WHERE categoria = 'debitos_cliente' 
  AND chave = 'debito_cancelamento_661836a7-a45e-4255-9b37-ec137225a706';

-- 2. Insere a taxa pendente de R$ 5,00 no formato novo (acumulativo e não-bloqueante)
INSERT INTO public.informacoes_empresa (tenant_id, chave, categoria, valor, ativo, atualizado_em)
VALUES (
  '5e825363-70ff-4abe-9143-9e87758437e7',
  'debito_cancelamento_661836a7-a45e-4255-9b37-ec137225a706',
  'debitos_cliente',
  jsonb_build_object(
    'id', gen_random_uuid(),
    'cliente_id', '661836a7-a45e-4255-9b37-ec137225a706',
    'cliente_nome', 'Cliente VIP Exclusive',
    'cliente_telefone', '(11) 99999-9999',
    'barbeiro_id', '1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770',
    'barbeiro_nome', 'Barbeiro VIP',
    'total_pendente', 5.00,
    'valor_taxa', 5.00,
    'status', 'pendente',
    'motivo', 'cancelamento_tardio',
    'itens', jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid(),
        'motivo', 'cancelamento_tardio',
        'status', 'pendente',
        'valor_taxa', 5.00,
        'barbeiro_id', '1cf7a87c-d4a4-4a63-8e2c-75a2cb5fb770',
        'barbeiro_nome', 'Barbeiro VIP',
        'created_at', now(),
        'tipo_taxa', 'fixo',
        'valor_servico_original', 50.00
      )
    ),
    'tenant_id', '5e825363-70ff-4abe-9143-9e87758437e7',
    'created_at', now()
  )::text,
  true,
  now()
);

-- 3. Notificação informativa no aplicativo
INSERT INTO public.notificacoes(user_id, tipo, titulo, mensagem, created_at)
VALUES (
  '661836a7-a45e-4255-9b37-ec137225a706',
  'cancelamento',
  'Taxa de cancelamento registrada',
  'Cancelamento com menos de 2h de antecedência. Taxa de R$ 5,00 registrada para seu próximo agendamento.',
  now()
);
