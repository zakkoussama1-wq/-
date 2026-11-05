# Production shipping quote repair

## Confirmed code defect

The checkout catalog endpoint used readShopifyCatalog in production, but the
commerce adapter rejected every production quote with `Shopify commerce adapter
required`. The HTTP handler converted this to the reported generic 503 error.
The form then rendered both methods as unavailable because it had no quote.
The stock quantity and enabled home shipping rule were never reached.

Removing that rejection alone would still select the local checkout catalog.
The canonical pricing service now selects the verified merchant's Shopify catalog
in Shopify mode, matching the catalog endpoint, and combines it with the same
merchant's persisted shipping snapshot and form policy. Validation uses the same
pricing service and quote token. No production local-product fallback was added.

## Office delivery and rules

Office delivery requires BOTH genericOffice=true and an effective rule with
available=true, office.enabled=true and a configured price. The current app has
no real carrier office directory; generic office pickup must be allowed explicitly
by the merchant. A price alone must never enable it. No rules or settings are
changed automatically by this patch.

Rule precedence remains commune > wilaya > default within the selected
administrative mode. An explicit disabled method or unavailable region blocks
fallback. A missing price/rule remains unavailable. Commune/wilaya membership and
product binding, quantities, inventory and form restrictions remain enforced.
Shipping storage/SQL did not require a change in the isolated regression tests.

The UI now distinguishes a missing/failed quote from a confirmed unavailable
method; it still disables methods until an available server quote exists.

## Verification and boundaries

208 tests passed with isolated PostgreSQL 18.6. The production API regression
uses synthetic merchant accounts and mocked Shopify read responses; no live
Shopify or Render connection is used. It exercises saved rates for wilaya codes
07, 34 and 21 with valid communes, generic-office off/on, exact totals in minor
currency units, commune overrides, disabled methods/regions, absent rates, invalid
commune membership, stock limits and product URL binding. Validation does not
persist an order; production order submission remains blocked as before.

Lint, type check and formatting checks passed. The production Docker build
passed, including Webpack compilation, Next.js type checking and standalone
private-data exclusion checks. The change is limited to production quote
calculation, its availability display, regression tests and this report.

## Review after a later deployment

Use the same merchant and administrative mode as the form when checking saved
shipping rules. Verify any commune exception before inspecting wilaya/default
rates. If generic office pickup is wanted, enable and save the existing checkbox
under shipping settings explicitly; this does not configure a carrier's offices.
Do not enable it merely to suppress an error. Check the quote API returns 200,
with available/amountMinor/totalMinor/reason for each method. A method disabled
by its effective rule or the form policy must remain unavailable.

This task does not verify the real saved Render rows or the live storefront. It
does not change Shopify stock, customer accounts, credentials or merchant data,
and creates no real orders. The existing production Shopify order workflow is
outside this quote-calculation repair and remains unimplemented/blocked.
