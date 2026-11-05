# COD ambiguity fix, durable single-order trial, and read-only preflight

Order sending remains OFF: `DZ_SHOPIFY_ORDER_SYNC=0`. This change does not contact
or modify the live store/database, create a real order, or enable a trial.
Existing scope-check drafts are separate local work; this patch does not further
change the scope endpoint or its dashboard button.

## Uncertain creation outcomes

`SyncFailure.outcome` separates `unknown` from proven `not_created`. A GraphQL
ACCESS_DENIED/THROTTLED code alone no longer clears the dispatch marker. Any
execution path (including the root `orderCreate` path), a `data` member (even
null), mixed/unknown errors or transport/storage failure is conservative.

Only an HTTP 401/403/429 rejection, a GraphQL request-level rejection with no data
member and no error paths and only recognized denial/throttle codes, or an
explicit successful-response `order:null` with nonempty `userErrors`, permits a
later creation attempt. No automatic HTTP mutation retry is used.

A potentially committed request retains `dispatched=1` and state `uncertain`,
even if subsequent authorization checks fail. Restart/retry only searches by the
fixed local reference/hash or reads the known Shopify ID. Search-index absence
never authorizes another creation. An available order ID is retained/reviewed,
including when the response also contains partial errors. This is conservative
application protection, not a native Shopify exactly-once guarantee. A request
that never reached Shopify can therefore remain uncertain indefinitely until
review; there is no force-create reset.

## Durable single-order trial

The default mode is `single_order`; missing/invalid settings fail closed. Future
settings (not applied by this task):

```dotenv
DZ_SHOPIFY_ORDER_SYNC=0
DZ_SHOPIFY_ORDER_SYNC_MODE=single_order
DZ_SHOPIFY_ORDER_TRIAL_ID=<one existing local order UUID>
DZ_SHOPIFY_ORDER_INVENTORY_POLICY=BYPASS
```

While sending remains disabled, the signed-in owner of that order can explicitly
POST `{ "id": "<same local UUID>" }` to
`/api/orders/shopify-sync/trial`, using a same-origin dashboard request/session.
This is a separate database WRITE that prepares the trial, not a readiness check.
It never creates a Shopify order and does not turn on sending. CSRF/origin, server
UUID equality, authenticated merchant ownership, local Shopify source and
non-cancelled state are enforced. A preparation with a different already-bound
ID or any processing job is refused. All deployed workers must be stopped or
sending disabled before preparation; do not mix old unfenced binaries with this
release. An old in-flight job must be reviewed, not deleted/reset to bypass this.

The singleton `shopify_order_trial` binds merchant/order durably. It cannot be
updated, deleted or truncated through normal SQL operations. Repeating identical
preparation is harmless. Changing the environment UUID cannot replace the binding.
No automatic cleanup/unbind or switch-to-another-order endpoint exists. Ending
this fence requires a separately reviewed operator migration, not just changing
an environment variable; database owners must not disable triggers or erase the
outbox to circumvent it.

Claims and pre-dispatch checks use the same transaction advisory lock as trial
preparation. The worker filters by both bound merchant and order. The dispatch
transaction checks again and fences the lease. PostgreSQL triggers independently
reject dispatch transitions for any other order and protect the immutable
binding. Trigger functions pin their creation search path. Backlog/new jobs stay
queued and untouched. Restarting or multiple workers does not reset the gate.

A worker configured with `all` is blocked while a durable trial exists. Explicit
`all` with NO durable trial retains general processing for future reviewed use;
it is never the default. UI retry cannot alter the scope or dispatch marker.
Only the selected local order can be created; genuine pre-execution rejections
may cause another attempt for that same order, but ambiguous attempts cannot.

The additive `005_shopify_single_order_trial.sql` and normal schema initialization
install the empty trial table and guard functions/triggers. Deployment changes
schema but does not choose an order or rewrite existing jobs. This migration was
exercised only on disposable PostgreSQL 18, never Render's database.

## Read-only readiness endpoint

`GET /api/orders/shopify-sync/readiness?id=<local UUID>` works with sending OFF.
It validates the existing hashed, unexpired merchant cookie and active verified
shop binding inside PostgreSQL `BEGIN READ ONLY`, including ownership of the
selected order. The proxy delegates this path to that authenticated handler so
schema-initializing authentication helpers are not called on the probe.

It checks schema columns, required queue uniqueness constraints, queue privileges,
trial triggers/binding/configuration, an unsent selected job and tenant-only queue counts. A missing, already dispatched or completed selected job cannot pass readiness for a new creation. It decrypts
current encrypted offline Session data without refreshing tokens, rewriting
metadata or initializing tables. Cached write permission and actual Shopify
read_products/write_orders grants are reported separately. It validates bound
shop identity, DZD and the supported `taxesIncluded=false` policy.

Every remote call is a query, never a mutation. Introspection validates the actual
2026-10 orderCreate inputs/options/enums against the selected order's payload;
a reference lookup validates the output selection. Version fallback, unsupported
fields, absent introspection, unsupported inventory/tax mappings or permissions
block readiness. The existing worker independently repeats schema/shop/scope
checks before any later mutation; preflight does not authorize sending.

A protected-data query reads an existing order's shipping firstName/phone/address1
but returns/logs none of those values. Only observed nonempty protected fields
provide evidence of read access. Empty/redacted results remain `unverified` and
keep `ready=false`; API denials block readiness. Successful reads do not establish
Shopify's protected-data WRITE approval or guarantee mutation acceptance. Review
that approval/distribution configuration with the owner separately. The response
explicitly reports `liveOrderCreationVerified:false`; `ready` only describes these
preflight checks at that instant, not proof of a live creation or absence of
external store automation.

No readiness call changes OAuth, refreshes credentials, creates schema/jobs,
repairs missing triggers, chooses the trial, sends customer notifications or
creates an order. Tests run this route with PostgreSQL's connection-level
`default_transaction_read_only=on` as an additional enforcement check.

## Controlled activation after review only

1. Keep sending OFF. Review this patch and deploy only when authorized. Confirm all
   workers use the new release and none is still processing a prior dispatch.
2. The owner selects a local Shopify COD order, configures the single UUID and
   BYPASS, then explicitly prepares the database binding while the flag stays 0.
3. Run the authenticated read-only readiness check. Investigate every blocked or
   unverified check. Confirm protected-data approval and independent Flow/apps,
   SMS/receipt, fulfillment and Purchase integrations before any creation.
4. Obtain separate approval for one REAL Shopify order. Only then enable the flag
   on the already-fenced deployment. Other old/new queued orders cannot dispatch.
5. Verify one matching remote ID, PENDING, full outstanding amount, exact item /
   shipping / discount / tax / DZD total, no receipts or fulfillment, and unchanged
   Shopify inventory under BYPASS. Local COD stock allocation remains separate.
6. Stop sending after the observation. For unknown results reconcile only. Do not
   clear dispatch fields, remove the gate or create a substitute order. Cancellation
   of the real trial order is a separate deliberate action, not automatic cleanup.

Tests use synthetic credentials/customers, mocked Shopify including its schema,
and isolated PostgreSQL schemas. No live API schema, real token, protected-data
approval, Render queue or real creation has been verified in this workspace.

## Order details UI

The order details dialog offers “Prepare Shopify trial” only when the authenticated
orders API supplies `trialPreparationAllowed:true` for that owned order. This hint
requires a Shopify-sourced, non-cancelled order matching the server's configured
single UUID, an enabled PostgreSQL configuration, sending OFF, and external
integrations available. No configured foreign order UUID is sent to the browser.
The existing POST still independently verifies the merchant, same-origin request,
server UUID and durable binding; a forged UI hint cannot authorize preparation.

“Check readiness” is available for owned Shopify orders, including those that are
not selected, so their blockers can be inspected without preparing them. Both
buttons use same-origin HttpOnly session cookies, no-store and redirect rejection.
Preparation and readiness requests disable competing actions while pending.
Responses are reset for each action/order; active requests are aborted on unmount.
The UI validates the read-only response and displays only allowlisted codes and
fixed Arabic/French/English descriptions. Raw upstream messages, customer fields,
tokens and unknown response fields are never rendered. Missing/expired sessions,
network failures, invalid reports and preparation conflicts have distinct safe
feedback. No activation or order-creation action was added.

The settings remain `DZ_SHOPIFY_ORDER_SYNC=0`, `single_order`, a server-configured
local UUID and `BYPASS`. This UI change does not prepare the real order during tests
or alter any Render/Shopify/database settings. UI tests use synthetic orders and
mocked endpoints; integration tests use isolated PostgreSQL and mocked Shopify.

## Local read-only diagnostics for the pinned trial

The trial panel adds an explicit diagnostics button for the owned order already
bound in PostgreSQL, including immediately after successful preparation. The
server endpoint is `GET /api/orders/shopify-sync/diagnostics?id=<local UUID>`.
It authenticates the unexpired hashed merchant session, checks order ownership,
active verified shop binding and the immutable trial row inside `BEGIN READ ONLY`.
Other owned orders, foreign merchants, expired sessions and arbitrary IDs are
rejected. No schema initialization/authentication-write helpers are called.

The response contains job existence, an allowlisted state, dispatched 0/1 (or null
if unavailable), attempts, an allowlisted error code and only a boolean for remote
ID presence. It never returns that ID, the local customer snapshot or payload.
Unknown stored error codes/states are replaced by fixed safe values. No dispatch,
state, attempt, lease or binding is reset; missing jobs are not recreated.

Credential diagnostics decrypt only in process memory and return boolean or null
indicators for record/session presence, explicit offline provenance, token presence,
key format, each decryption stage, shop binding, access expiry, and refresh presence
and time validity. Missing/expired access, expired/missing refresh, bad key format,
failed authenticated decryption and malformed session data have separate fixed
reason codes. Null means not determined; a failed decryption does not imply an
absent/expired token. Correct key format does not establish that it is the right
key for the stored records. Refresh validity means local timestamps only, not
proof that Shopify would accept it. A non-expiring token has expired=false.

There is no network call, OAuth flow, refresh, repair, retry or mutation. Responses
report `readOnly:true, networkChecked:false` and no-store. Neither the route nor
the decoder logs credentials or exception messages. No token, key, ciphertext,
customer field, URL or identifier is returned in the diagnostic body. The UI uses
validated scalar fields, fixed translated messages and safe reason codes only;
it never renders raw server errors or extra response properties. Local success
is not evidence of live token acceptance or protected-data approval.

Regression tests exercise enforced connection-level read-only transactions through
the production proxy/handler, tenant and pinned-order isolation, unchanged order /
job / credential snapshots, no remote calls, uncertain dispatch markers, missing
legacy jobs, redaction, wrong/missing keys, corrupted metadata, missing credentials,
online/wrong-shop sessions and independent access/refresh expiry.
