# Shipping — Phase 3

Persistent local shipping is implemented in `data/shipping.sqlite`, independent of the geography seed-owned file. Never add this database to the geography reseed script. Tables are initialized additively on first use without deleting prices. `SHIPPING_DATABASE_PATH` may select another absolute path. Writes use a transaction and optimistic revision; stale updates return HTTP 409.

- `schema.ts`: strict request schemas, nonnegative DZD (maximum 10,000,000, up to two decimal places), scopes, method settings.
- `repository.ts`: server-only callers use merchant + mode in every query/write. Validated geography targets; transactional batches; no client merchant selection.
- `calculator.ts`: one shared deterministic precedence algorithm. Commune > wilaya > default > unavailable. A matching rule's unavailable status, disabled method, or missing price blocks fallback. Zero is free, null is unset. A selected rule replaces the entire lower-priority rule, not just one method.
- `service.ts`: authoritative server quote entry point, validates actual commune-to-wilaya membership before reading merchant settings. Future order creation must call this function and recalculate all prices server-side.
- `csv.ts`: strict quoted CSV parsing, all-or-nothing validation, duplicate rejection, spreadsheet-formula escaping on export, Arabic headers and error messages. File mode is selected by the dashboard, not inferred from the CSV. CSV updates only explicit records and never enables generic office mode.
- `http.ts`: same-origin JSON mutations, strict schemas, no-store responses, server-derived local merchant context and explicit error states.

## Tenant context and boundary

This phase does **not** implement authentication. `LOCAL_MERCHANT_ID` binds the local server to one merchant (default `local-development-merchant`). It is a non-secret development selector, not an authorization credential. Clients cannot supply merchant IDs in requests, headers or query strings. Repository tests verify different merchants and modes do not share rules. This is not a production multi-user authorization guarantee: every person with access to this unauthenticated local server can manage its bound merchant. Keep development local; replace this resolver with authenticated session authorization in Phase 6 before public deployment. Do not claim login or tenant authentication exists.

Office delivery requires explicit `genericOffice` opt-in AND an enabled office rate. No office records or shipping-company prices are invented. Named office management is not implemented.

Rates are isolated by administrative mode. Switching 58/69 does not copy rates automatically. 69-mode geography keeps the secondary-source warning from Phase 2. Public order submission remains disabled and no consumer order form shipping integration is claimed before Phase 4.
