# Architecture rules

- Keep barber payment configuration parsing and fallback selection in a pure library, and database/Reatime lifecycle in a dedicated hook; this makes the rules testable and prevents leaked subscriptions.
- Scope booking payment configuration reads by both tenant and selected barber key; this prevents cross-tenant configuration reuse.