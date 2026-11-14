-- Normaliza formatos de horário (HH:mm:ss -> HH:mm) em todas as tabelas
-- de configuração de expediente.
--
-- CAUSA RAIZ: alguns registros armazenam hora_abertura/hora_fechamento
-- com segundos (ex: "08:00:00") e outros sem (ex: "19:00"). As edge
-- functions comparam horários numericamente via timeToMinutes (que ignora
-- segundos), então a comparação já funcionava. O defeito visível era a
-- interpolação de valores brutos nas mensagens de erro, produzindo formatos
-- mistos como "(08:00:00-19:00)."
--
-- Esta migração padroniza todos os campos de hora para HH:mm (segundos
-- zerados) em todos os inquilinos, unidades e barbeiros, corrigindo a
-- inconsistência de dados na raiz. É idempotente: executar novamente não
-- altera registros já normalizados.

UPDATE public.configuracoes_horario
SET
  hora_abertura = date_trunc('minute', hora_abertura)::time,
  hora_fechamento = date_trunc('minute', hora_fechamento)::time,
  hora_almoco_inicio = date_trunc('minute', hora_almoco_inicio)::time,
  hora_almoco_fim = date_trunc('minute', hora_almoco_fim)::time
WHERE
  extract(second from hora_abertura) > 0
  OR extract(second from hora_fechamento) > 0
  OR (hora_almoco_inicio IS NOT NULL AND extract(second from hora_almoco_inicio) > 0)
  OR (hora_almoco_fim IS NOT NULL AND extract(second from hora_almoco_fim) > 0);

UPDATE public.configuracoes_horario_unidade
SET
  hora_abertura = date_trunc('minute', hora_abertura)::time,
  hora_fechamento = date_trunc('minute', hora_fechamento)::time,
  hora_almoco_inicio = date_trunc('minute', hora_almoco_inicio)::time,
  hora_almoco_fim = date_trunc('minute', hora_almoco_fim)::time
WHERE
  extract(second from hora_abertura) > 0
  OR extract(second from hora_fechamento) > 0
  OR (hora_almoco_inicio IS NOT NULL AND extract(second from hora_almoco_inicio) > 0)
  OR (hora_almoco_fim IS NOT NULL AND extract(second from hora_almoco_fim) > 0);

UPDATE public.configuracoes_horario_barbeiro
SET
  hora_abertura = date_trunc('minute', hora_abertura)::time,
  hora_fechamento = date_trunc('minute', hora_fechamento)::time,
  hora_almoco_inicio = date_trunc('minute', hora_almoco_inicio)::time,
  hora_almoco_fim = date_trunc('minute', hora_almoco_fim)::time
WHERE
  extract(second from hora_abertura) > 0
  OR extract(second from hora_fechamento) > 0
  OR (hora_almoco_inicio IS NOT NULL AND extract(second from hora_almoco_inicio) > 0)
  OR (hora_almoco_fim IS NOT NULL AND extract(second from hora_almoco_fim) > 0);

UPDATE public.horarios_excepcionais
SET
  hora_abertura = date_trunc('minute', hora_abertura)::time,
  hora_fechamento = date_trunc('minute', hora_fechamento)::time,
  hora_almoco_inicio = date_trunc('minute', hora_almoco_inicio)::time,
  hora_almoco_fim = date_trunc('minute', hora_almoco_fim)::time
WHERE
  extract(second from hora_abertura) > 0
  OR extract(second from hora_fechamento) > 0
  OR (hora_almoco_inicio IS NOT NULL AND extract(second from hora_almoco_inicio) > 0)
  OR (hora_almoco_fim IS NOT NULL AND extract(second from hora_almoco_fim) > 0);

UPDATE public.horarios_excepcionais_barbeiro
SET
  hora_abertura = date_trunc('minute', hora_abertura)::time,
  hora_fechamento = date_trunc('minute', hora_fechamento)::time,
  hora_almoco_inicio = date_trunc('minute', hora_almoco_inicio)::time,
  hora_almoco_fim = date_trunc('minute', hora_almoco_fim)::time
WHERE
  extract(second from hora_abertura) > 0
  OR extract(second from hora_fechamento) > 0
  OR (hora_almoco_inicio IS NOT NULL AND extract(second from hora_almoco_inicio) > 0)
  OR (hora_almoco_fim IS NOT NULL AND extract(second from hora_almoco_fim) > 0);
