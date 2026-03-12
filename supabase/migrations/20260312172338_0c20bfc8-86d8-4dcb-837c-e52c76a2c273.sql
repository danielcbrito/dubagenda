SELECT cron.schedule(
  'cleanup-expired-pending-bookings',
  '*/30 * * * *',
  $$ SELECT public.clean_expired_pending_bookings(); $$
);