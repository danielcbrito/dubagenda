-- 1. Harden RLS for agendamentos
-- First drop existing update policy to be safe
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios agendamentos" ON public.agendamentos;

CREATE POLICY "Usuários podem atualizar seus próprios agendamentos"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  -- Restrict fields: only allow these to be modified by the client
  (
    (OLD.status IS NOT DISTINCT FROM NEW.status OR NEW.status = 'cancelled_by_user') AND
    OLD.barbeiro_confirmou IS NOT DISTINCT FROM NEW.barbeiro_confirmou AND
    OLD.is_free IS NOT DISTINCT FROM NEW.is_free AND
    OLD.ponto_liberado IS NOT DISTINCT FROM NEW.ponto_liberado AND
    OLD.preco IS NOT DISTINCT FROM NEW.preco AND
    OLD.payment_method IS NOT DISTINCT FROM NEW.payment_method
  )
);

-- 2. Harden award_loyalty_point trigger
CREATE OR REPLACE FUNCTION public.award_loyalty_point()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
    v_tenant_id uuid;
    v_points_needed integer;
    v_user_points integer;
    v_already_awarded_today boolean;
BEGIN
    -- Get tenant_id from the appointment
    v_tenant_id := NEW.tenant_id;

    -- 1. Only award points if the appointment is COMPLETED AND CONFIRMED BY BARBER
    IF NEW.status = 'completed' AND NEW.barbeiro_confirmou = true AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.barbeiro_confirmou IS DISTINCT FROM NEW.barbeiro_confirmou) THEN
        
        -- 2. Fraud prevention: limit 1 point per day per user
        SELECT EXISTS (
            SELECT 1 FROM public.agendamentos 
            WHERE user_id = NEW.user_id 
              AND status = 'completed' 
              AND barbeiro_confirmou = true
              AND id != NEW.id
              AND created_at::date = NEW.created_at::date
              AND ponto_liberado = true
        ) INTO v_already_awarded_today;

        IF v_already_awarded_today THEN
            RETURN NEW;
        END IF;

        -- 3. Award the point
        UPDATE public.profiles
        SET loyalty_points = COALESCE(loyalty_points, 0) + 1
        WHERE id = NEW.user_id;

        -- Mark as awarded
        NEW.ponto_liberado := true;

        -- 4. Check if they reached the threshold for a new reward
        SELECT pontos_necessarios INTO v_points_needed
        FROM public.fidelidade_config
        WHERE tenant_id = v_tenant_id
        LIMIT 1;

        IF v_points_needed IS NULL THEN v_points_needed := 8; END IF;

        SELECT loyalty_points INTO v_user_points
        FROM public.profiles
        WHERE id = NEW.user_id;

        IF v_user_points >= v_points_needed THEN
            -- Create a new redemption record
            INSERT INTO public.resgates (user_id, tenant_id, status)
            VALUES (NEW.user_id, v_tenant_id, 'available');
            
            -- Deduct points
            UPDATE public.profiles
            SET loyalty_points = loyalty_points - v_points_needed
            WHERE id = NEW.user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Fix consume_redemption_on_appointment_insert
CREATE OR REPLACE FUNCTION public.consume_redemption_on_appointment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.payment_method = 'resgate' THEN
        -- Check if user has an available redemption
        IF NOT EXISTS (
            SELECT 1 FROM public.resgates 
            WHERE user_id = NEW.user_id 
              AND tenant_id = NEW.tenant_id 
              AND status = 'available'
        ) THEN
            RAISE EXCEPTION 'Nenhum resgate disponível para este usuário.';
        END IF;

        -- Use one redemption
        UPDATE public.resgates
        SET status = 'used', appointment_id = NEW.id
        WHERE id = (
            SELECT id FROM public.resgates
            WHERE user_id = NEW.user_id
              AND tenant_id = NEW.tenant_id
              AND status = 'available'
            ORDER BY created_at ASC
            LIMIT 1
        );

        NEW.is_free := true;
    ELSE
        -- Ensure is_free is false if not using resgate (unless it's a plan, but plans use different logic usually)
        IF NEW.payment_method != 'plano' THEN
          NEW.is_free := false;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Audit Log for cleanup (optional but recommended)
CREATE TABLE IF NOT EXISTS public.loyalty_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

GRANT ALL ON public.loyalty_audit_logs TO service_role;
GRANT SELECT ON public.loyalty_audit_logs TO authenticated;

-- 5. Cleanup script: Reset points for users with >1 completed appointment per day
-- This is a manual one-time fix logic that could be run or logged.
-- We will just log the potential fraud cases for now.
INSERT INTO public.loyalty_audit_logs (user_id, action, details)
SELECT 
    user_id, 
    'potential_fraud_detected', 
    jsonb_build_object('date', created_at::date, 'count', count(*))
FROM public.agendamentos
WHERE status = 'completed' AND barbeiro_confirmou = true
GROUP BY user_id, created_at::date
HAVING count(*) > 1;

