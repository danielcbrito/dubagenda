-- 1) Gatilho de consumo: confirmar/concluir um agendamento que JÁ é de plano não revalida
CREATE OR REPLACE FUNCTION public.consume_plan_use_on_appointment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  DECLARE
    v_assinatura_id uuid;
    v_limite integer;
    v_usados integer;
    v_competencia date;
    v_sub_status text;
    v_next_billing date;
    v_cycle_start date;
    v_cycle_end date;
    v_cash_pending boolean;
    v_privileged boolean;
  BEGIN
    IF NEW.tipo_agendamento = 'plano_registro_interno' THEN
      RETURN NEW;
    END IF;

    IF COALESCE(NEW.payment_method, '') <> 'plano' AND COALESCE(NEW.tipo_agendamento, '') NOT IN ('plano', 'assinatura_silenciosa') THEN
      RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
      -- Já era plano: o uso foi validado na criação. Confirmar/concluir não revalida.
      IF COALESCE(OLD.payment_method, '') = 'plano'
         OR COALESCE(OLD.tipo_agendamento, '') IN ('plano', 'assinatura_silenciosa', 'plano_registro_interno') THEN
        RETURN NEW;
      END IF;
      IF NEW.status::text IN ('cancelled_by_user', 'cancelled_by_admin', 'no_show', 'excluido') THEN
        RETURN NEW;
      END IF;
    END IF;

    v_competencia := date_trunc('month', NEW.data)::date;

    SELECT a.id, COALESCE(p.limite_agendamentos_mes, 4), a.status::text, a.next_billing_date,
           (a.payment_method::text = 'cash' AND COALESCE(a.cash_payment_confirmed, false) = false)
      INTO v_assinatura_id, v_limite, v_sub_status, v_next_billing, v_cash_pending
    FROM public.assinaturas a
    JOIN public.planos p ON p.id = a.plano_id
    WHERE a.user_id = NEW.user_id
      AND a.status IN ('active', 'pending_cash')
    ORDER BY a.next_billing_date DESC NULLS LAST, a.created_at DESC NULLS LAST
    LIMIT 1;

    v_privileged := (auth.role() = 'service_role')
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'ti'::app_role)
      OR EXISTS (SELECT 1 FROM public.barbeiros b WHERE b.id = NEW.barbeiro_id AND b.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.barbeiros b JOIN public.tenants t ON t.id = b.tenant_id
                 WHERE b.id = NEW.barbeiro_id AND t.owner_user_id = auth.uid());

    IF v_assinatura_id IS NULL THEN
      IF v_privileged OR NEW.tipo_agendamento = 'assinatura_silenciosa' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'PLANO_INEXISTENTE'
        USING detail = 'Nenhuma assinatura ativa encontrada para este cliente.',
              hint = 'Assine um plano para agendar com plano.';
    END IF;

    IF v_sub_status = 'pending_cash' OR v_cash_pending THEN
      v_limite := 1;
    END IF;

    IF v_next_billing IS NOT NULL THEN
      v_cycle_start := (v_next_billing - INTERVAL '1 month')::date;
      v_cycle_end := v_next_billing;
    ELSE
      v_cycle_start := '-infinity'::date;
      v_cycle_end := 'infinity'::date;
    END IF;

    IF EXISTS (SELECT 1 FROM public.plano_agendamentos_usos WHERE agendamento_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    v_usados := public.count_subscription_uses_in_cycle(v_assinatura_id, v_cycle_start, v_cycle_end);

    IF v_usados >= v_limite AND NOT v_privileged THEN
      RAISE EXCEPTION 'PLANO_SEM_CREDITOS'
        USING detail = format('Limite de %s agendamento(s) do plano já utilizado neste ciclo.', v_limite),
              hint = 'Aguarde a renovação do plano ou a confirmação do pagamento em dinheiro pelo barbeiro.';
    END IF;

    INSERT INTO public.plano_agendamentos_usos (user_id, assinatura_id, agendamento_id, competencia)
    VALUES (NEW.user_id, v_assinatura_id, NEW.id, v_competencia)
    ON CONFLICT (agendamento_id) DO NOTHING;

    RETURN NEW;
  END;
$fn$;

-- 2) Gatilho de período: não bloqueia confirmação/conclusão nem ações do barbeiro
CREATE OR REPLACE FUNCTION public.enforce_plan_booking_within_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_period_end date;
  v_period_start date;
  v_booking_date date;
  v_sub_status text;
BEGIN
  IF COALESCE(NEW.payment_method, '') <> 'plano' AND COALESCE(NEW.tipo_agendamento, '') <> 'plano' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status::text IN ('cancelled_by_user', 'cancelled_by_admin', 'no_show', 'excluido', 'completed') THEN
      RETURN NEW;
    END IF;
    IF NEW.data IS NOT DISTINCT FROM OLD.data
       AND (COALESCE(OLD.payment_method, '') = 'plano' OR COALESCE(OLD.tipo_agendamento, '') = 'plano') THEN
      RETURN NEW;
    END IF;
  END IF;

  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'ti'::app_role)
     OR EXISTS (SELECT 1 FROM public.barbeiros b WHERE b.id = NEW.barbeiro_id AND b.user_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.barbeiros b JOIN public.tenants t ON t.id = b.tenant_id
                WHERE b.id = NEW.barbeiro_id AND t.owner_user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_booking_date := NEW.data::date;

  SELECT a.next_billing_date, a.status::text
    INTO v_period_end, v_sub_status
  FROM public.assinaturas a
  WHERE a.user_id = NEW.user_id
    AND a.status IN ('active', 'pending_cash')
  ORDER BY a.next_billing_date DESC NULLS LAST, a.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_sub_status = 'pending_cash' THEN
    RETURN NEW;
  END IF;

  IF v_period_end IS NULL THEN
    RAISE EXCEPTION 'NO_ACTIVE_SUBSCRIPTION_PERIOD';
  END IF;

  v_period_start := (v_period_end - INTERVAL '1 month')::date;

  IF v_booking_date < v_period_start OR v_booking_date > v_period_end THEN
    RAISE EXCEPTION 'PLAN_BOOKING_OUT_OF_PERIOD';
  END IF;

  RETURN NEW;
END;
$fn$;

-- 3) Restauração dos dados (sem disparar notificações/gatilhos)
SET LOCAL session_replication_role = replica;

INSERT INTO public.plano_servicos (plano_id, servico_id)
SELECT p.id, p.servico_id FROM public.planos p
WHERE p.tenant_id = '73d61f2f-b369-41f3-8915-8e6de52d6378' AND p.servico_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.plano_servicos ps WHERE ps.plano_id = p.id AND ps.servico_id = p.servico_id);

-- Cortes lançados como avulso por engano (clientes com plano)
UPDATE public.agendamentos
SET payment_method = 'plano', tipo_agendamento = 'plano', is_free = true, preco = 0, preco_final = 0, updated_at = now()
WHERE id IN ('84e8e511-4fe2-4ce8-97ab-dca44e7ce361', 'dd8c8be4-0393-488a-92a9-d9c19991bba7');

CREATE TEMP TABLE _restore (user_id uuid, plano_id uuid, barbeiro_id uuid, ini date, fim date, expired boolean) ON COMMIT DROP;
INSERT INTO _restore VALUES
 ('83036ad9-bbc3-4d24-b034-b5ce748c61d9','b0c0de00-5000-4c0e-9000-000000000003','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-09-04','2026-10-04',false),
 ('23498a07-8ba4-47cf-a82f-918d83a8da16','b0c0de00-5000-4c0e-9000-000000000002','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-09-28','2026-10-28',false),
 ('c6e726ba-5657-4cf2-94db-ff9ac2e7a1a6','b0c0de00-5000-4c0e-9000-000000000003','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-09-09','2026-10-09',false),
 ('5f7054de-7603-4517-b607-077d75e77669','b0c0de00-5000-4c0e-9000-000000000001','ee238642-bc38-4de6-ba86-9eed40262fc7','2026-09-11','2026-10-11',false),
 ('7f1fe1ce-3c29-49a4-a6db-cb098e4b2e1b','b0c0de00-5000-4c0e-9000-000000000003','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-09-19','2026-10-19',false),
 ('9135b3bf-ed0f-493d-b74c-1e3675d68616','b0c0de00-5000-4c0e-9000-000000000002','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-09-15','2026-10-15',false),
 ('c18de679-8c35-4383-ab47-c8fd2af6abd7','b0c0de00-5000-4c0e-9000-000000000003','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-09-12','2026-10-12',false),
 ('68736cef-b78b-49ee-b3d9-11e6edbdc23b','b0c0de00-5000-4c0e-9000-000000000001','ee238642-bc38-4de6-ba86-9eed40262fc7','2026-09-10','2026-10-10',false),
 ('74f6f1b3-508c-4236-81d9-935f2b207e95','b0c0de00-5000-4c0e-9000-000000000003','ee238642-bc38-4de6-ba86-9eed40262fc7','2026-09-11','2026-10-11',false),
 ('98996040-b257-4427-9117-b4b777591906','b0c0de00-5000-4c0e-9000-000000000003','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-09-19','2026-10-19',false),
 ('d1de638f-a01d-45d0-87ee-fcd5bfa00c99','b0c0de00-5000-4c0e-9000-000000000003','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-10-02','2026-11-02',false),
 ('fde0117a-b9bb-4e38-9132-e096245af670','b0c0de00-5000-4c0e-9000-000000000002','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-10-01','2026-11-01',false),
 ('46ac000e-ea23-4ae7-a915-7758952bdba7','b0c0de00-5000-4c0e-9000-000000000002','ee238642-bc38-4de6-ba86-9eed40262fc7','2026-08-01','2026-09-01',true),
 ('46e1a2bd-2015-406e-b0e8-4786927f535d','b0c0de00-5000-4c0e-9000-000000000001','ee238642-bc38-4de6-ba86-9eed40262fc7','2026-08-01','2026-09-01',true),
 ('9f7dcdba-941a-44c9-aee8-dbb6e7a64e0a','b0c0de00-5000-4c0e-9000-000000000001','ee238642-bc38-4de6-ba86-9eed40262fc7','2026-08-01','2026-09-01',true),
 ('2d6ad840-2c85-4080-aa90-0cdff6d82e6a','b0c0de00-5000-4c0e-9000-000000000001','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-08-01','2026-09-01',true),
 ('ef8bb400-9517-45f7-b81c-93d05e2874ea','b0c0de00-5000-4c0e-9000-000000000001','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-08-01','2026-09-01',true),
 ('6533e1b3-e674-4086-9662-b5770e1c3146','b0c0de00-5000-4c0e-9000-000000000003','767c51a7-7323-4933-8fc5-9a666f6baa7c','2026-08-01','2026-09-01',true);

-- Só cria para quem ainda não tem assinatura
DELETE FROM _restore r WHERE EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.user_id = r.user_id);

INSERT INTO public.assinaturas (user_id, plano_id, barbeiro_id, status, payment_method, cash_payment_confirmed,
  ciclo_inicio, ciclo_fim, next_billing_date, usos_ciclo_atual, created_at, updated_at)
SELECT r.user_id, r.plano_id, r.barbeiro_id, 'active', 'cash', true,
  r.ini, r.fim, r.fim, 0, (r.ini::timestamp AT TIME ZONE 'America/Sao_Paulo'), now()
FROM _restore r;

-- Usos do ciclo atual a partir dos cortes de plano já marcados
INSERT INTO public.plano_agendamentos_usos (user_id, assinatura_id, agendamento_id, competencia, created_at)
SELECT ag.user_id, s.id, ag.id, date_trunc('month', ag.data)::date,
  LEAST(GREATEST(ag.created_at, (r.ini::timestamp AT TIME ZONE 'America/Sao_Paulo') + interval '1 minute'),
        (r.fim::timestamp AT TIME ZONE 'America/Sao_Paulo') - interval '1 minute')
FROM _restore r
JOIN public.assinaturas s ON s.user_id = r.user_id AND s.plano_id = r.plano_id AND s.ciclo_inicio = r.ini
JOIN public.agendamentos ag ON ag.user_id = r.user_id
WHERE NOT r.expired
  AND (ag.payment_method = 'plano' OR ag.tipo_agendamento = 'plano')
  AND ag.data >= r.ini AND ag.data < r.fim
  AND ag.status::text NOT IN ('cancelled_by_user','cancelled_by_admin','excluido','no_show')
ON CONFLICT (agendamento_id) DO UPDATE
  SET assinatura_id = EXCLUDED.assinatura_id, created_at = EXCLUDED.created_at, released_at = NULL;

-- Contador do ciclo
UPDATE public.assinaturas s
SET usos_ciclo_atual = CASE WHEN r.expired THEN COALESCE(p.limite_agendamentos_mes, 4)
  ELSE (SELECT count(*) FROM public.plano_agendamentos_usos u WHERE u.assinatura_id = s.id AND u.released_at IS NULL) END
FROM _restore r, public.planos p
WHERE s.user_id = r.user_id AND s.plano_id = r.plano_id AND s.ciclo_inicio = r.ini AND p.id = s.plano_id;

-- Atualiza a tela inicial dos clientes
UPDATE public.client_home_snapshot SET is_stale = true WHERE user_id IN (SELECT user_id FROM _restore);

SET LOCAL session_replication_role = origin;