# Production COD persistence repair

## Confirmed root cause

POST /api/orders resolved the merchant and called localCommerceAdapter.submit.
The adapter rejected every production submission with `Shopify order workflow is
not implemented`; the route hid that error behind the reported generic message.
The database insertion was never reached. This was independent of valid phone,
shipping rates or the product's available inventory.

The existing createOrder transaction also read only the local checkout catalog
and updated local product stock. Removing the adapter guard alone would not save
Shopify-backed products safely. The repair routes submission through that existing
transaction with an authoritative Shopify catalog snapshot in Shopify mode.

## Resulting behavior

- A COD lead/order is stored in this app's PostgreSQL orders table. It does not
  create a Shopify order, change Shopify stock or send notifications/tracking.
- The catalog comes from the verified merchant's existing Shopify reader; there
  is no fallback to local demo products. Provider reads occur before order locks.
- The server validates the same form policy and product URL binding as the quote,
  recalculates shipping and totals, checks availability/stock, and compares the
  quote token before inserting. Explicitly disabled methods remain unavailable.
- Phone normalization supports Algerian national, +213, 00213 and Arabic digits.
  Office delivery accepts a blank home address and requires no office identifier.
  Generic-office opt-in and an enabled priced office rule are still required.
  Commune membership in the selected wilaya/mode remains checked on the server.
- Tenant/session checks remain enforced. Production still requires the existing
  authenticated, verified Shopify merchant session; this patch does not introduce
  anonymous storefront authorization or an authentication bypass.
- PostgreSQL's existing transaction, merchant advisory lock and unique
  (merchant_id,key) constraint prevent duplicate inserts. Same-key retries with
  the same normalized customer data return the original ID, including when the
  provider is unavailable. Reusing the key with different data returns 409.
- Existing noncancelled Shopify-sourced COD rows count as local stock allocations
  under the same merchant lock. This prevents concurrent local requests exceeding
  the read stock quantity without changing the Shopify cache or provider stock.
  Cancellation releases the local allocation; confirmed/fulfilled rows continue
  to count. This is a conservative local ledger, not a reservation in Shopify or
  protection against independent sales elsewhere. Future reconciliation with
  Shopify is outside this fix.
- Product name, SKU, image, unit price and quote remain immutable order snapshots.
  The only new metadata is catalogSource inside the existing JSON data column;
  no table migration or import of SQLite demo records is required.
- Production ignores simulation metadata and skips all simulation recording on
  submission and status changes, including Purchase on fulfillment.

## Safe error responses

Validation returns 400/INVALID_ORDER with fixed field messages (phone, name,
address, region, method, product, quantity or quote token), never submitted values.
Session/tenant refusal returns 401/AUTH_REQUIRED. Changed quote or idempotency
conflict returns 409; unavailable methods or insufficient stock return 422.
Unexpected persistence/provider failures return 503/ORDER_SAVE_UNAVAILABLE with
safe retry guidance. Logs contain only event, stage and an allowlisted error code;
no raw exception message, request body, customer details, SQL or connection URL.
The existing UI displays these Arabic responses; receipt display still requires
persisted=true and a real application order ID.

## Verification

212 tests passed with disposable PostgreSQL 18.6 and mocked Shopify read-only
GraphQL responses. The fixture transport rejects GraphQL mutations. Coverage:

- Tamanrasset (11), Idles/Adles (dz:commune:359), product 1200 DZD and office 555
  DZD persist at exactly 175500 minor units; no office ID/address is required.
- Concurrent same-key requests return 201/200 and one persisted order/ID; retry
  succeeds after provider invalidation/unavailability. Different-body key reuse
  returns 409. Another merchant cannot read the saved lead.
- Blank office address succeeds; blank home address fails with a useful message.
  A valid home address persists at the independently configured home rate.
- Invalid phone, wrong commune, invented office ID, foreign tenant, incorrect
  product URL, disabled office and changed rates fail without saving an order.
- Concurrent different-key requests with one unit of stock save only one lead;
  cancellation permits another. Shopify stock and cached inventory stay unchanged.
- Confirmation/fulfillment create no simulation table or Purchase events in the
  production test. Mocked storage failure logs a safe code without customer data.
- Lint, type checking, formatting and the production Docker build passed,
  including Next.js compilation and standalone private-data exclusion checks.

No live Render database, real Shopify orders, stock, customer accounts or secrets
were accessed or modified. All database writes in tests target disposable local
schemas. The release scope is limited to COD persistence, safe error responses,
its regression tests and this report.
