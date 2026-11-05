# Phase 2: inline Shopify COD form (validation only)

This implementation creates no orders, persists no customer submission, changes no
inventory, emits no Purchase event, and does not enable sending. Keep
`DZ_SHOPIFY_ORDER_SYNC=0`. The existing merchant UI, OAuth, local order page,
PostgreSQL outbox and immutable single_order trial fence are retained.

## Extension and presentation

`extensions/dz-cod-form` contains a Theme App Extension manifest, a product-only
Liquid App Block, and generated production JavaScript assets. A small schema loader (under 10,000 bytes) fetches the isolated UI runtime only when the block approaches the viewport. It uses the Liquid-resolved Shopify asset URL, validates its origin/path, loads once across duplicates, and offers a safe retry after download failure. Build with
`npm run storefront:build`. The same command runs before the Next production build.
The browser build uses pinned esbuild and existing React/Zod dependencies. It has
no Next runtime, admin credentials or dependency on the dashboard's language provider.

The block is inline, never a mandatory popup, external page or iframe. Placement
is controlled by Theme Editor and the theme's supported app-block locations.
Settings expose language, heading, intro/button/footer text, colours, maximum width
and alignment. Script text is escaped by Liquid and rendered as React text. Colour
and proxy-path attributes are validated. The fixed phase-2 notice cannot be removed
through block settings. A merchant-provided button label never changes server behavior. Built-in copy and the default heading follow the selected language; custom merchant text is rendered as entered (provide its translations in the theme settings).

A custom element mounts one form per product with isolated Shadow DOM styles.
Language/RTL belongs to that form, not html/body, the theme or document title.
Native element connection/disconnection handles dynamic Shopify section replacement,
aborts old requests, removes listeners and promotes a remaining duplicate only
when the active instance disappears. Standard cart-add variant/quantity controls,
value-attribute changes and scoped/document variant events are supported. A block
in a separate Apps section can observe the main product section. The widget also
has its own authoritative variant/quantity controls. Exotic themes without standard
product controls may require a small theme-specific adapter; universal compatibility
with every unpublished/custom theme is not claimed.

The form displays current product image/title/variant/unit price, quantity, full
name, Algerian phone, 58-wilaya/commune selection, home/generic-office delivery,
conditional home address, discounts, shipping and total. Quantity stays within the
existing server limit of 1–10. A changed pricing input invalidates the previous
quote immediately; no stale/fabricated final total authorizes validation.

Current shipping storage supports a generic-office switch, not an authoritative
list of named physical pickup offices. No offices, addresses or IDs are invented.
Office prices remain unavailable when that switch is off even if prices exist.
The existing commune/wilaya/default precedence and explicit disablement are reused.

## Signed public transport

Future App Proxy mapping:

- Storefront prefix/subpath: `/apps/dz-cod` (customizable, must match block setting).
- Upstream URL: `https://YOUR_APP_HOST/api/storefront`.

Operations under that upstream prefix:

| Endpoint  | Method    | Behavior                                                                                                                       |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| bootstrap | GET       | Verified current product, safe presentation, 58 wilayas and short-lived form context.                                          |
| communes  | GET       | Geography reference for the requested valid wilaya.                                                                            |
| quote     | POST JSON | Fresh authoritative product price and existing server shipping/discount calculation.                                           |
| validate  | POST JSON | Contact/location/variant/quantity/quote revalidation only; returns validated=true, persisted=false, shopifyOrderCreated=false. |

The dedicated proxy allowlist delegates only these four paths to their own handler.
Existing merchant API/session guards are not relaxed. Direct unsigned Render
requests fail. The official installed Shopify SDK verifies App Proxy signatures,
its 90-second timestamp tolerance and duplicate security parameters. Additional
consumed parameters reject duplicates. The merchant is resolved solely from the
signed shop and active verified installation, never a browser merchant/store ID.
App Proxy signatures authenticate the proxy/shop, not an individual customer.

Mutating HTTP methods here perform validation only. They require JSON, an 8 KiB
body limit, and a 10-minute HMAC form capability bound to the verified shop,
product and accepted storefront origin. The observed Origin must match when present;
the capability still applies when Shopify strips it. Bootstrap accepts only the
verified primary domain or canonical myshopify domain. Additional Markets/custom
alias domains require an explicit reviewed domain-verification extension; arbitrary
browser origins are not trusted. There are no permissive CORS headers or admin
cookies in the storefront authorization path. The browser uses same-origin store
requests; app-proxy forwarding is not assumed to preserve cookies or custom headers.

A bounded in-memory per-process/shop read budget allows 180 operations per minute,
with at most 1024 active shop windows. It stores no customer/IP data and writes no
SQL. Excess work returns 429/Retry-After. This is not a distributed/global rate
limit and must be load-tested before general production rollout.

## Authoritative data and side effects

PostgreSQL reads use `BEGIN READ ONLY` and no schema-initializing helpers. Current
Offline Session decoding is local and never refreshes/replaces credentials. An
expired/unusable token stops the request rather than using demo data or silently
changing authorization.

Each product/quote/validation read uses Admin GraphQL 2026-10 and verifies the served
API version, bound shop identity and DZD currency. Products must be ACTIVE and have
an onlineStoreUrl on an accepted store domain. Variant pages are bounded and prices
are converted to integer minor units by the existing parser. A fresh final price
or shipping change invalidates the old quote. Browser names, images and amounts are
not accepted as authoritative request inputs.

Stored form policy, real shipping rules and configured discount snapshots are read
for that signed shop. The existing priceCheckoutSnapshot and shipping engine do the
calculation. There is no orderCreate, transaction/payment, inventory mutation,
notification, customer write, outbox enqueue or advertising call in this transport.
No snapshot of entered personal data is returned or logged. Errors expose fixed
codes, not provider/DB exception messages. The final response does not claim an
order exists locally or remotely.

## Deployment later: owner review required

No real Shopify/Render/PostgreSQL settings were changed by this work. No extension
was linked, uploaded, released or installed. Deployment is separate from building
Render and must be reviewed before publishing.

1. Review this patch, reference-image styling and the existing real-token diagnostics.
   An unresolved Offline credential blocker will also block the storefront; this
   phase never repairs it. Existing sync/trial settings stay unchanged and OFF.
2. Prepare a LOCAL `shopify.app.toml` using the sample and the correct app identity.
   Use Shopify CLI to link to the existing app under the owner's account; do not
   create/replace the app, change distribution or enable automatic URL updates.
3. Review required `write_app_proxy` configuration access in the target Shopify/CLI
   setup. Existing product reads require read_products. Incoming proxy verification
   itself uses the existing Client Secret and requires no Storefront API token.
   This patch does not change requestedShopifyScopes/OAuth or assume a new grant.
   If Shopify requires a new grant, explicitly configure/request write_app_proxy
   and review reauthorization separately before enabling the proxy. No write_themes,
   write_inventory, write_customers or read_orders scope is added by this phase.
4. Configure the App Proxy URL/prefix/subpath in the correct app version. An example
   template is in shopify.app.toml.example; it is not a live configuration change.
5. Build the extension, run the supported Shopify CLI validation/build for that
   linked app, inspect the version, and only then deploy/release with owner approval.
   Local official Theme Check 5.0.1 validates the extension with zero findings, including the schema JavaScript size check. Live upload limits, application identity and the actual 2026-10 schema still require validation under the owner's linked account. Do not interpret local Theme Check as proof of a published extension. The larger runtime is lazy-loaded and should be measured on the actual storefront/mobile connection before broad rollout.
6. In Theme Editor, add DZ COD Form to a product-information section supporting
   app blocks, or a supported Apps section below it. Set matching proxy path and
   language/style. Test the actual theme and its variant interactions on a controlled
   store. A theme lacking app-block support cannot be made compatible solely by an
   extension, and exact right-column placement depends on the theme.
7. Confirm validation-only messaging and keep DZ_SHOPIFY_ORDER_SYNC=0. There is no
   order submission or sending activation in this phase, even if someone changes
   the button's text. Phase 3 requires its own review and retains the existing fences.

The reference Jeep Buluo images were not attached with the phase-2 instruction.
The delivered white compact responsive card follows the written requirements;
pixel-level matching awaits those images. Multicurrency, automatic Shopify Checkout
discounts/tax calculations, named pickup-office catalogs and production order/status
submission are not implemented by this phase. Shopify Checkout is not invoked.

## Verification

Automated integration tests use isolated PostgreSQL 18 schemas, synthetic encrypted
Offline credentials and mocked Shopify GraphQL. They verify signatures, expired and
duplicate queries, CSRF/product/origin binding, shop isolation, untouched merchant
protection, current prices, unavailable methods, geographic mismatch, missing rates,
invalid phone/address/quantity, publication/API-version failures and read-only
snapshot preservation with zero orders/jobs. Browser tests load the real generated
bundle into controlled product-column and below-details theme-like layouts on desktop
and mobile; every network request is intercepted. They exercise language isolation,
quantity/variant/product changes, totals, section re-mount/deduplication and failures.
Real Shopify themes/Theme Editor, extension release and the real database were not
accessed or changed. Final counts/build results are reported with the implementation.

To reproduce browser verification without any live storefront or Next server:
`npm run test:storefront` (install Playwright Chromium first). In this managed cloud,
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. All storefront/page,
product-image, bootstrap, quote and validate requests are intercepted fixtures.

For the reviewed command sequence, identity checks, version-release impact and storefront acceptance checklist, see [deployment preparation](SHOPIFY-STOREFRONT-DEPLOYMENT.md).
