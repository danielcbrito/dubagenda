
UPDATE configuracoes_horario_barbeiro
SET hora_abertura = '08:00', hora_fechamento = '20:00', updated_at = now()
WHERE barbeiro_id = '767c51a7-7323-4933-8fc5-9a666f6baa7c'
AND dia_semana = 6;
