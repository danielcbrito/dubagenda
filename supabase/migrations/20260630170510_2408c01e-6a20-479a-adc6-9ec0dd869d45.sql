
CREATE TABLE IF NOT EXISTS public.ai_security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  severidade text NOT NULL CHECK (severidade IN ('low','medium','high','critical')),
  titulo text NOT NULL,
  descricao text NOT NULL,
  resumo_ia text,
  cliente_id uuid,
  cliente_nome text,
  evidencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  enviado boolean NOT NULL DEFAULT false,
  enviado_em timestamptz,
  erro_envio text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_security_alerts TO authenticated;
GRANT ALL ON public.ai_security_alerts TO service_role;
ALTER TABLE public.ai_security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem alertas" ON public.ai_security_alerts;
CREATE POLICY "Admins veem alertas" ON public.ai_security_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_alerts_created ON public.ai_security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_cliente ON public.ai_security_alerts(cliente_id);

CREATE TABLE IF NOT EXISTS public.ai_monitor_state (
  key text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_monitor_state TO service_role;
ALTER TABLE public.ai_monitor_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem state" ON public.ai_monitor_state;
CREATE POLICY "Admins veem state" ON public.ai_monitor_state
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Agendamento a cada 5 minutos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-security-monitor-tick') THEN
    PERFORM cron.unschedule('ai-security-monitor-tick');
  END IF;
END $$;

SELECT cron.schedule(
  'ai-security-monitor-tick',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://djtpzvujzmrrslirzwun.supabase.co/functions/v1/ai-security-monitor',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdHB6dnVqem1ycnNsaXJ6d3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTUwMTcsImV4cCI6MjA3ODI3MTAxN30.7rWUhWV7d5pdvEjTrnddBzo8gsRZBFrO6JtvDDpksb8"}'::jsonb,
    body := jsonb_build_object('source','cron','at', now())
  );
  $$
);
