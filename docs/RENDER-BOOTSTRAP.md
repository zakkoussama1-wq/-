# Safe initial Render deployment

This is a bootstrap endpoint, not an operational store. No Shopify installation,
store changes or real customer orders are performed by deployment.

## Existing service (manual deployment)

Use the existing `dz-lead-form-pro-test` Web Service, repository branch `main`,
Docker runtime, Frankfurt region, Free plan, Dockerfile `./Dockerfile`, context `.`,
health check `/api/health`, and disable automatic deployment while configuring.
Do not apply render.yaml to this service: that separate paid blueprint creates a
separate database and persistent disk. No custom build/start command is needed.
The container listens on 0.0.0.0 and uses Render's PORT.

Set these variables securely in Render (never put values in Git):

- NODE_ENV=production
- DZ_BOOTSTRAP_MODE=1
- DATABASE_URL: connection string for existing `dz-lead-form-db-test` in Frankfurt.
  Remote TLS certificate verification remains required. Do not use sslmode=disable
  or disable certificate verification if connection fails.
- INTEGRATIONS_ENCRYPTION_KEY: existing stable 64-character hexadecimal key.
  Preserve it across deploys; rotating it without migration loses access to secrets.
- MEDIA_STORAGE_DRIVER=local
- MEDIA_STORAGE_PATH=/app/data/media

Leave SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET and SHOPIFY_REDIRECT_URI unset for
bootstrap. Remove DZ_LOCAL_DEMO, DZ_AUTH_TEST_BYPASS and LOCAL_MERCHANT_ID.
No fake Shopify credentials are needed. PORT is supplied by Render.

Free local storage is ephemeral: images uploaded there will be lost on replacement,
redeploy or restart. Use this plan only to obtain the HTTPS endpoint and test setup.
Before storing real product media, arrange persistent storage (e.g. paid disk with
an appropriate mount path); the current driver is local. Database data remains in
PostgreSQL, subject to Render's database plan retention/expiry and backups.

## Behavior and database safety

Bootstrap exposes /api/health; dashboard, login submissions, forms, media, data APIs,
OAuth, catalog sync and webhooks return 503 SETUP_REQUIRED. Existing authentication
and tenant checks still apply when bootstrap is disabled. Merely adding credentials
does not enable integrations: explicitly set DZ_BOOTSTRAP_MODE=0 after configuration.

The production health route initializes the existing PostgreSQL schema using
CREATE TABLE/INDEX IF NOT EXISTS under a transaction and advisory lock, then queries
the database. Failed initialization/connectivity returns 503 without error details.
It does not run the SQLite migration script or import demo data, delete records,
or overwrite business rows. Existing incompatible schemas require a separate
reviewed migration; health remains unhealthy on initialization failure.

## After receiving the HTTPS URL

1. Confirm Render deployment is Live and GET https://<service-host>/api/health
   returns HTTP 200 with ok=true. Other app routes intentionally return 503.
2. In Shopify Dev Dashboard, create/configure the app yourself. Set App URL to
   https://<service-host>/ and allowed redirect URL exactly to
   https://<service-host>/api/integrations/shopify/callback. This app uses a
   non-embedded OAuth flow and requests read_products; do not add write scopes
   or assume real Shopify order submission is implemented.
3. In Render, securely set SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
   SHOPIFY_REDIRECT_URI to that exact callback, and SHOPIFY_SHOP to the authorized
   store (currently h8vsym-t0.myshopify.com). Keep the database and encryption key.
4. Set DZ_BOOTSTRAP_MODE=0 and redeploy. Validate health and verify unauthenticated
   dashboard/data requests are denied before using real data.
5. Create/sign into your merchant account via /login. Only when you separately
   authorize live store access, initiate OAuth from the integrations dashboard,
   review read_products permission, then verify the connection/catalog sync.
   Callback code registers uninstall/product lifecycle webhooks. No installation
   or OAuth is performed by this preparation task.
6. Test COD workflows with synthetic customer data only after persistent media
   storage and store access are authorized. Existing local COD persistence does
   not prove creation of orders in Shopify or real advertising delivery.

Local Docker/PG checks do not verify the Render connection string, certificates,
account limits, database expiry, Shopify credentials or live authorization. Confirm
these through the first deployment's health and redacted logs.

## Verification performed for this change

- Lint, formatting, type check and 202 tests passed, with PostgreSQL 18.6.
- Actual Docker build completed, including the production Webpack build and
  standalone private-data exclusion check.
- Production container without Shopify credentials: health 200 on PORT=10000;
  dashboard, form, private media, auth POST, order POST, OAuth start/callback,
  synchronization and webhook requests returned 503.
- Separate production container with an unreachable database: health 503.
- App restart preserved a synthetic database sentinel; accounts/orders were not
  seeded from SQLite. The healthy container's Docker health command passed.
- No Render deployment or live Shopify connection was performed.
