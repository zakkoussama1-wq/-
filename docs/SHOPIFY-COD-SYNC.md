# Shopify COD synchronization — implementation and activation review

The feature is OFF by default. No Render settings, Shopify settings, real database,
customer records or inventory were changed during implementation. No live Shopify
order was created. Do not enable on a live store before reviewing this document.

## Data flow and files

- `src/modules/orders/repository.ts`: writes the local COD order and its outbox job
  in the same transaction. Failed job insertion rolls the whole transaction back.
  Local save success never depends on a successful Shopify API operation.
- `src/modules/orders/shopify/outbox.ts` and `types.ts`: additive queue schema,
  tenant-scoped enqueue/retry and safe UI state. Jobs have a unique local order
  key, remote ID, attempts, lease/fencing token, dispatch marker, immutable request
  snapshot/hash, bound shop ID and a safe diagnostic code. No tokens are stored here.
- `client.ts` and `contract.ts`: offline authorization, effective scope/shop checks,
  API version verification, runtime schema validation, payload mapping and matching.
- `worker.ts` and `src/instrumentation.ts`: durable claim/process/reconcile loop.
- `/api/orders/shopify-sync`: authenticated, tenant-bound, origin-checked POST
  accepting only `{id}`. The browser cannot supply prices, payloads, merchant IDs,
  access tokens, remote IDs or a force-create instruction.
- `src/components/orders/dashboard.tsx` and translations: sync state, diagnostic
  code, Shopify ID, refresh and safe retry in order details (Arabic/French/English).
- `scripts/postgres-schema.sql` plus additive migration
  `scripts/migrations/004_shopify_order_outbox.sql`: CREATE IF NOT EXISTS only.
  No import, destructive migration, inventory update or history rewrite.

The authoritative remote ID is stored in the linked PostgreSQL outbox row and
returned as `order.shopifySync.shopifyOrderId`. Local order snapshots stay intact.
Existing orders without a job show "not queued"; an authorized user can enqueue
one from details. New Shopify-sourced COD leads are queued even while sending is
turned off. Other local/demo products are never sent to Shopify.

## Permissions and offline session

The existing required base scope remains `read_products`. When the order feature
is explicitly enabled, OAuth requests the additional `write_orders` only. Shopify's
write scope implies the corresponding read scope (also covered by the installed
SDK's scope tests); no separate `read_orders`, `read_all_orders`, `write_inventory`,
`write_products` or `write_customers` scope is requested.

Existing token grants do not change when code is deployed. Reauthorization is
required before order sending. Product reads/refreshes keep their original base
scope requirement, so lack of order permission does not disable product sync.

Before an attempt, the client requires encrypted offline Session metadata, refuses
online/missing/expired unusable sessions, verifies the stored write_orders grant,
and queries currentAppInstallation.accessScopes to confirm the effective grant.
It verifies the authenticated shop ID/domain and DZD currency. Token refresh uses
the existing encrypted-session workflow. Old raw-token-only installations need
reauthorization to establish offline provenance.

Name, phone and shipping address are protected customer data. Scope consent alone
may not grant all required fields: complete Shopify's protected customer data
configuration/approval for the app's distribution type. Denials pause the job with
a safe diagnostic. They never lose the lead or expose raw customer-bearing errors.

## Actual schema gate and what was NOT live-verified

The target endpoint is exactly `/admin/api/2026-10/graphql.json`. Every response
must identify API version 2026-10; a fallback to another version blocks creation.

The public Shopify documentation request returned HTTP 403 in this environment.
No authenticated introspection was sent to the real store, in accordance with the
mock-only requirement. The test schema is explicitly a mocked contract, not an
export of Shopify's live 2026-10 schema.

Consequently, no claim of live schema compatibility or real-store success is made.
Before its first mutation the implementation introspects the actual endpoint's
orderCreate arguments and nested input types/enums and validates the complete
payload, required fields, notification and inventory options. A read-only lookup
also validates the response selection against the actual API. Missing/unsupported
fields, unavailable introspection, extra required arguments or version mismatch
stop the job before any mutation. Unsupported contracts require a reviewed code
update; the implementation does not silently drop safety fields or guess a new
mutation shape. Optional sourceIdentifier is used only when supported by both
input and output types; otherwise custom reference attributes remain mandatory.

## Order contents and money

Only `orderCreate` is used. Requests specify PENDING, no transactions/capture,
no fulfillment, sendReceipt=false and sendFulfillmentReceipt=false. COD is labeled
by the order's application metadata/tags and shipping method; no fictitious
payment transaction or gateway registration is created.

The immutable local snapshot supplies variant GID, quantity, original unit price,
DZD amounts, the stored fixed discount amount, delivery method and shipping charge.
Phone is converted from validated Algerian national format to +213. Country is DZ,
wilaya/commune come from the validated geography reference, and only the actual
stored street address/name/phone/pickup instructions are included. An office lead
has no invented street or pickup office ID. If Shopify requires missing address
information, its explicit rejection pauses the job for review.

On success/reconciliation we compare order/variant/quantity/reference, unit price,
DZD grand total, full outstanding amount, shipping, discount and tax totals, and
PENDING status. A returned ID is retained even if its financial data need review;
no replacement order is created to "fix" a mismatch.

Important tax boundary: current DZ quotes contain no separate VAT breakdown.
The implementation forwards zero additional tax, and refuses unexplained tax
amounts or a tax-inclusive shop policy with TAX_BREAKDOWN_REQUIRED. It does not
invent rates, waive tax globally, or silently reprice a local order. Stores that
need a tax breakdown must add an authoritative local tax-pricing snapshot/mapping
before those jobs can safely sync. Nonzero stored discounts are mapped only when
the actual orderCreate discount input contract supports the mapping.

## Inventory policy

`DZ_SHOPIFY_ORDER_INVENTORY_POLICY` defaults to BYPASS. BYPASS creates the Shopify
order without deducting/reserving Shopify inventory. The application's existing
conservative local COD allocation ledger continues to prevent concurrent local
leads exceeding the read stock; it is not a Shopify inventory reservation.

The policy is part of the persisted immutable request snapshot/hash. Retrying a
job never changes its inventory policy and never calls an inventory mutation.
Only BYPASS is supported/tested in this release; any other configured value blocks
creation. Enabling a decrement policy later requires a reviewed extension and
reconciliation of the local ledger to avoid counting the same reservation twice.

## Idempotency and uncertain outcomes

No native orderCreate idempotency support is assumed, nor is sourceIdentifier or
a tag treated as a unique Shopify constraint. The mechanism is:

1. PostgreSQL uniqueness prevents multiple jobs for a local order and multiple
   local links to the same Shopify ID within the merchant.
2. The job is bound to a shop and deterministic `dz-cod-<local UUID>` reference;
   custom attributes include the local ID and immutable payload hash.
3. A transaction claims a job with a lease and fencing token. A durable dispatch
   marker/request snapshot is committed before the network mutation. Stale workers
   cannot send when they lose their lease. No HTTP/SDK mutation retries are enabled.
4. Before creation, search by the reference tag across order statuses, then verify
   the local ID/hash, sourceIdentifier when present, variant/quantity and money.
   Multiple/mismatched references require review and never bind an unrelated ID.
5. Once a valid remote ID is known, reconciliation reads that ID directly. An
   ambiguous attempt without an ID only searches/reconciles; absence from the
   eventually consistent search index NEVER authorizes another creation.
6. A timeout, lost reply, crash after dispatch or failed local success update keeps
   the dispatch marker. Retry/restart can attach the existing Shopify order but
   cannot send another orderCreate. Explicit HTTP throttling/auth rejection or
   an order=null plus userErrors response can be retried without assuming success.

If an ambiguous request never reached Shopify and there is no matching order,
this conservative mechanism cannot automatically prove that it is safe to create
again. It remains uncertain/manual review rather than risk duplication. This is
not an exactly-once guarantee supplied by Shopify. No force-create button exists.
Reconciliation stops automatic searches after 55 days because read_all_orders is
not requested; unresolved older attempts require manual review.

Local cancellation stops an unsent job. Cancellation after possible remote creation
requires review; this feature does NOT automatically cancel, fulfill, pay, refund
or edit the Shopify order. Status changes create no Purchase events.

## Running and activating later (user action only)

1. Keep `DZ_SHOPIFY_ORDER_SYNC=0` or unset while reviewing/deploying the code.
   The database/encryption/media/health configuration remains unchanged.
2. In Shopify app configuration, allow the optional write_orders scope and confirm
   protected customer data access. Review store automations as well: API receipt
   flags do not control independent Shopify Flow/apps responding to a new order.
3. On a controlled test store first, explicitly set DZ_SHOPIFY_ORDER_SYNC=1 and
   DZ_SHOPIFY_ORDER_INVENTORY_POLICY=BYPASS, restart/redeploy, and reauthorize OAuth.
   Jobs lacking the new grant pause instead of sending. No settings were changed
   by this task, and no real-store test was performed.
4. Use the details retry action on a selected lead after authorization. New queued
   jobs can run automatically as soon as the feature is enabled and grants exist;
   inspect the queue before enabling. Review schema gate results before live use.
5. The Next.js Node instrumentation starts one bounded worker per server process,
   processing at most one job every 30 seconds. PostgreSQL coordinates processes;
   retries back off, honor throttling and stop automatic retries after repeated
   definite failures. Durable tasks resume on restart. On Render Free, sleeping
   services do not provide immediate background delivery; tasks wait until wake.
6. Details display the current locally recorded sync outcome and remote ID. They
   are not a live mirror of later Shopify payment/fulfillment changes. Refresh
   or use the safe retry/reconciliation action as appropriate.

Do not treat "local order saved" as "Shopify order created" or "paid". The existing
customer receipt confirms only local persistence. The async sync state is separate.

## Verification

Tests use an isolated PostgreSQL 18 database and mocked Shopify HTTP/schema data.
They cover atomic local/job rollback, feature off, offline/effective grants,
sourceIdentifier fallback, actual-contract/version rejection, exact amounts,
address/quantity, tax-policy refusal, discounts, concurrency, explicit rejection,
throttling, ambiguous timeouts, lost success writes, lease recovery, unrelated or
multiple matches, cancellations, legacy leads, tenant isolation and protected retry.
No real Shopify orders, notifications, stock changes or Purchase events are sent.
Browser tests mock the orders API and verify enabled/disabled retry and detail
states on desktop and mobile. Final test counts/build outcome are in the task report.

## Final verification results for this implementation

- 232 unit/integration tests passed (33 files), with PostgreSQL 18.6 isolated
  schemas and mocked Shopify HTTP/schema responses. No skipped tests in that run.
- 4 Playwright UI tests passed on Chromium desktop/mobile with mocked order APIs.
  The cloud test server used a temporary Webpack override; tracked configuration
  and Next generated declarations were restored afterward.
- Lint, TypeScript checking, formatting, production Docker build and standalone
  private-data exclusion checks passed on the final application code.
- Production image startup with the worker flag on and an empty disposable
  PostgreSQL queue returned health 200; orders/jobs both remained zero.
- Runtime/live Shopify schema, real token grants, protected-data approval and
  actual order creation were NOT tested against the real store. The runtime
  contract gate must pass before activation can send a mutation.

## Complete file inventory

- `.env.example`
- `docs/SHOPIFY-COD-SYNC.md`
- `scripts/migrations/004_shopify_order_outbox.sql`
- `scripts/postgres-schema.sql`
- `shopify.app.toml.example`
- `src/app/api/integrations/shopify/callback/route.ts`
- `src/app/api/orders/shopify-sync/route.ts`
- `src/components/orders/dashboard.tsx`
- `src/instrumentation.ts`
- `src/lib/messages.ts`
- `src/modules/integrations/shopify/connections.ts`
- `src/modules/integrations/shopify/sdk.ts`
- `src/modules/orders/repository.ts`
- `src/modules/orders/shopify/client.ts`
- `src/modules/orders/shopify/contract.ts`
- `src/modules/orders/shopify/outbox.ts`
- `src/modules/orders/shopify/types.ts`
- `src/modules/orders/shopify/worker.ts`
- `src/proxy.ts`
- `tests/local-demo/shopify-sync.spec.ts`
- `tests/shopify-order-sync.integration.test.ts`
