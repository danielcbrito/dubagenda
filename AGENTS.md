# Architecture rules

- Keep barber payment configuration parsing and fallback selection in a pure library, and database/Reatime lifecycle in a dedicated hook; this makes the rules testable and prevents leaked subscriptions.
- Scope booking payment configuration reads by both tenant and selected barber key; this prevents cross-tenant configuration reuse.
- Record cancellation debt in an appointment status trigger within the same transaction; this covers direct writes as well as Edge Functions and prevents duplicate fees.
- Keep cancellation debts private; permit only the linked authenticated barber to read and waive their tenant-scoped debts through RLS plus an immutable-field trigger, and settle payments only via a service-only RPC after authoritative gateway lookup; this supports the existing barber panel without client self-release or forged payments.
- Enforce pending cancellation debts on appointment and booking-hold inserts, including service-role writes; this makes the client overlay non-authoritative and prevents API bypasses.
- Apply authoritative debt release events by row and tenant before revalidation, invalidating older reads; this unlocks immediately without clearing unrelated debts or allowing stale reads to restore a released block.
- Keep pre-signup WhatsApp OTP storage server-only with explicit frontend privilege revocation; verification codes must never be readable through browser database access.