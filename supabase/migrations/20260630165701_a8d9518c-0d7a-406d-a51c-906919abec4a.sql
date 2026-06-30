-- Fix: BEFORE INSERT trigger sets resgates.appointment_id = NEW.id, but the
-- agendamentos row doesn't exist yet, violating the FK. Make the FK deferrable
-- so it's checked at end of transaction.
ALTER TABLE public.resgates
  DROP CONSTRAINT IF EXISTS resgates_appointment_id_fkey;

ALTER TABLE public.resgates
  ADD CONSTRAINT resgates_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.agendamentos(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;