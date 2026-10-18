# Architecture rules

- Keep barber payment configuration parsing and fallback selection in a pure library, and database/Reatime lifecycle in a dedicated hook; this makes the rules testable and prevents leaked subscriptions.
- Scope booking payment configuration reads by both tenant and selected barber key; this prevents cross-tenant configuration reuse.
- Record cancellation debt in an appointment status trigger within the same transaction; this covers direct writes as well as Edge Functions and prevents duplicate fees.
- Keep cancellation debts private in company information, deny browser mutations, and settle only via a service-only RPC after an authoritative gateway lookup; this prevents financial data leaks and forged payment confirmations.
- Enforce pending cancellation debts on appointment and booking-hold inserts, including service-role writes; this makes the client overlay non-authoritative and prevents API bypasses.
- Apply authoritative debt release events by row and tenant before revalidation, invalidating older reads; this unlocks immediately without clearing unrelated debts or allowing stale reads to restore a released block.