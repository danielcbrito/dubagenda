SELECT cron.schedule(
  'cleanup-pending-payments',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url:='https://djtpzvujzmrrslirzwun.supabase.co/functions/v1/cleanup-pending-payments',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqdHB6dnVqem1ycnNsaXJ6d3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTUwMTcsImV4cCI6MjA3ODI3MTAxN30.7rWUhWV7d5pdvEjTrnddBzo8gsRZBFrO6JtvDDpksb8"}'::jsonb,
    body:='{"action": "auto_cleanup"}'::jsonb
  ) AS request_id;
  $$
);