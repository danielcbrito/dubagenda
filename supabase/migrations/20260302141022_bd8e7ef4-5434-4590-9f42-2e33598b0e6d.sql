
-- 1) Mover exceção global do Túlio para tabela por barbeiro
INSERT INTO horarios_excepcionais_barbeiro (barbeiro_id, data, aberto, hora_abertura, hora_fechamento, hora_almoco_inicio, hora_almoco_fim, motivo)
SELECT '767c51a7-7323-4933-8fc5-9a666f6baa7c', data, aberto, hora_abertura, hora_fechamento, hora_almoco_inicio, hora_almoco_fim, motivo
FROM horarios_excepcionais WHERE id = '8ef70670-68b9-4b55-852e-93b65742e392'
ON CONFLICT DO NOTHING;

-- 2) Deletar a exceção global que estava afetando todos
DELETE FROM horarios_excepcionais WHERE id = '8ef70670-68b9-4b55-852e-93b65742e392';
