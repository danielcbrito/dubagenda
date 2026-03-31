
INSERT INTO public.bloqueios_cliente_barbeiro (user_id, barbeiro_id, motivo)
VALUES ('d70d9a7a-212d-4ee5-9d49-909e3bc9d577', 'ee238642-bc38-4de6-ba86-9eed40262fc7', 'Bloqueio solicitado pelo administrador')
ON CONFLICT (user_id, barbeiro_id) DO NOTHING;
