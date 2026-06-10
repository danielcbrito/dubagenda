text
## Security Audit and Loyalty System Hardening Plan

Based on the investigation, several vulnerabilities were found that allow users to exploit the "free cut" system:
1. Permissive RLS: Clients can mark their own appointments as "completed" and "confirmed", awarding themselves loyalty points.
2. Fraudulent Activity: Several users have been creating 5-6 fake appointments on the same day to reach the reward threshold.
3. One-off Logic Error: The current system incorrectly blocks users from earning a second free cut once they've used their first one (it's not recurring).
4. Validation Bypass: Users can bypass point checks by manipulating the `payment_method` and `is_free` fields during appointment creation.

### Technical Steps

#### 1. Harden Row Level Security (RLS)
- Update `agendamentos` UPDATE policy for users:
    - Prevent clients from changing `status`, `barbeiro_confirmou`, `is_free`, `ponto_liberado`, or `preco`.
    - Clients should only be able to update `observacoes`, `remarcacao_solicitada`, and `motivo_remarcacao`, or change status to `cancelled_by_user`.

#### 2. Fix and Harden Database Triggers
- **`award_loyalty_point`**:
    - Remove the `v_has_previous_redemption` check to make the program recurring (every X points = new free cut).
    - Add a check to ensure points are ONLY awarded if the appointment was confirmed by the **barber**.
    - Add a fraud check: prevent awarding points if the user already had a completed appointment on the same day (limit 1 point per day).
- **`consume_redemption_on_appointment_insert`**:
    - Ensure it uses the `pontos_necessarios` from the active promotion instead of a hardcoded value (8).
    - Correct NULL handling for user points to prevent bypasses.
- **`enforce_resgate_flags`**:
    - Ensure `is_free` is forced to `false` if the `payment_method` is not `resgate` or `plano`.

#### 3. Data Cleanup and Fraud Correction
- Identify users with suspicious patterns (e.g., >2 completed appointments on a single day).
- Reset points and invalidate `available` resgates for these fraudulent users.
- Log the cleanup actions in `loyalty_audit_logs`.

#### 4. Frontend Consistency
- Ensure the frontend doesn't rely on being able to set `is_free` directly, but rather through the `payment_method = 'resgate'`.

### Security Verification
- Verify that a client attempt to set `status = 'completed'` via API fails.
- Verify that a client attempt to create a free cut without points fails.
