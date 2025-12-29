-- Criar cron job para gerar relatório mensal automaticamente
-- Executa no primeiro dia de cada mês às 00:05 (horário do servidor)
-- Isso gera o relatório do mês anterior automaticamente
SELECT cron.schedule(
  'generate-monthly-report-end-of-month',
  '5 0 1 * *',
  $$
  SELECT net.http_post(
    url:='https://djtpzvujzmrrslirzwun.supabase.co/functions/v1/generate-monthly-report',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdHB6dnVqem1ycnNsaXJ6d3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTUwMTcsImV4cCI6MjA3ODI3MTAxN30.7rWUhWV7d5pdvEjTrnddBzo8gsRZBFrO6JtvDDpksb8"}'::jsonb,
    body:='{"auto_generate": true}'::jsonb
  ) as request_id;
  $$
);