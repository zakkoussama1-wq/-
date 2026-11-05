# Shopify scope check: session context and dashboard action

## Findings

The dashboard uses the `dz_session` HttpOnly cookie, not a Bearer token or browser
storage token. Login sets Path=/, SameSite=Strict and an eight-hour lifetime; HTTPS
requests set Secure. The cookie policy is unchanged by this repair.

Two independently reproduced reasons explained the misleading AUTH_REQUIRED:

1. A cross-site navigation from an external link does not send the Strict cookie
   on its first request. An internal same-origin fetch does. The same browser can
   therefore have a valid saved cookie and still get 401 from that external link.
   Typing an address or navigating within the same origin is different; this does
   not mean every direct navigation omits the cookie. A different hostname also
   does not share the login cookie.
2. The dashboard's generic session check accepts the legacy owner session, but
   production merchant APIs require a session with merchant_id and a verified
   Shopify binding. Previously the proxy's generic precheck conflated missing
   cookies, legacy sessions, unlinked accounts and database failures into the same
   AUTH_REQUIRED response before the scopes handler could explain the difference.

These behaviors were verified with isolated tests, not captured from the user's
live Render request headers. The exact live request's missing/expired cookie or
account binding cannot be inferred from the old generic response alone.

## Repair

The integrations page now has a "Check Shopify permissions" button. It uses the
same relative native fetch and HttpOnly-cookie model as other dashboard requests,
with explicit credentials=same-origin, cache=no-store and redirect=error. It sends
no shop selector, merchant ID, Bearer token or credentials from JavaScript.

Results display read_products and write_orders as granted/not granted only after
a verified API response. Loading/errors clear older results; a failed check never
means permissions are absent. The UI offers a merchant-login link for session
errors and distinct messages for an unlinked shop, forbidden tenant and upstream
connection failures. No raw server error or secret is rendered. Arabic, French
and English messages are included.

The scopes route skips only the redundant generic production tenant precheck.
It is STILL protected by the proxy's session-required integrations guard, followed
by the handler's full merchant/verified-shop authorization. It is not a public or
unauthenticated endpoint. No alternate tenant/global-store fallback was added.

The authorization helper now classifies failures while preserving the same checks:

- 401 AUTH_REQUIRED: missing, invalid or expired merchant session.
- 403 MERCHANT_SESSION_REQUIRED: valid legacy owner session without merchant_id.
- 409 SHOPIFY_CONNECTION_REQUIRED: merchant account has no verified shop binding.
- 403 TENANT_FORBIDDEN: caller attempts another tenant's selector.
- 503 AUTH_CHECK_FAILED: auth-store failure, not a claimed login failure.

The existing API version check/currentAppInstallation.accessScopes query and
current-token/no-refresh behavior remain intact. The stored token is selected
from the authenticated merchant and compared with the verified shop domain.
It is never returned or logged. No OAuth, order creation, token refresh, grant
change, inventory change or sync enablement is performed by this action.

## Verification

- 240 unit/integration tests passed against PostgreSQL 18.6 disposable schemas
  and mocked Shopify responses, without skipped cases.
- 4 Chromium browser tests passed on desktop/mobile. They reproduce external
  Strict-cookie omission followed by authenticated same-origin button success,
  check explicit granted/missing results, and cover session/tenant/connection
  errors and stale-result clearing without rendering secret-bearing fake errors.
- Tests exercise the real proxy plus real session/tenant/credential readers for
  two isolated merchants, a legacy owner and an unlinked account. Foreign-store
  requests make no Shopify call. Credential rows remain unchanged.
- Lint, type checking, formatting and production Docker build passed, including
  the standalone private-data exclusion check.

After deployment, use Dashboard -> Integrations -> Check Shopify permissions
from the same origin where you signed in. For MERCHANT_SESSION_REQUIRED, use the
email-based merchant account linked to the shop; do not remove the app, reset
accounts or change the session cookie policy. The diagnostics reveal effective
permissions only when run against the deployed connection, not from mock tests.

No real Render/PostgreSQL/Shopify settings or data were changed in this task.
DZ_SHOPIFY_ORDER_SYNC remains 0; no real orders, notifications or Purchase events
were created or sent. The only temporary databases/credentials are test fixtures.
