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
  For the short Render Internal Database URL use the private transport described
  below. External connections retain verified TLS; never disable certificate checks.
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

## Troubleshooting a Render health-check timeout

Next.js Ready and a detected port prove the listener started, not database readiness.
Bootstrap deliberately permits /api/health. Keep that path unchanged and keep
DZ_BOOTSTRAP_MODE=1. Production health now uses its own bounded PostgreSQL pool,
not authDb (which previously ran authentication DDL and could leak a connection
when initialization failed). Failed transactions are discarded and initialization
is retried. An HTTP readiness wait is limited to 3 seconds; unhealthy returns 503.
The schema is initialized once per process, without SQLite import or row updates.

1. Deploy the latest main commit manually. Keep Docker runtime, default container
   command and Render-provided PORT. Do not add a command that bypasses preflight.
2. Check the database resource is Available, not expired/suspended, and is the
   intended Frankfurt PostgreSQL resource. Confirm DATABASE_URL was copied from
   that resource into this Web Service's Environment, with no quotes/newlines.
   Never paste the value into chat or logs. Confirm the username/database/password
   belong to that resource; keep the existing encryption key unchanged.
3. Read runtime logs for `database_readiness_failed`. Only a stage and a fixed
   error code are logged; raw driver errors, SQL, hostnames and credentials are
   intentionally omitted. The public response remains only ok=false with 503.
4. Interpret the code:
   - ENOTFOUND/EAI_AGAIN: hostname or DNS. Verify the correct database URL and region.
   - ECONNREFUSED/ECONNRESET/ETIMEDOUT/DB_TIMEOUT: endpoint, availability, network
     access or overload. Check database status, connections and service events.
   - 28P01/28000: authentication; recopy current database credentials securely.
   - 3D000: database does not exist; use the selected database's connection string.
   - TLS_UNSUPPORTED: check whether this is the short Internal Database URL and
     follow the private transport configuration below. For external endpoints,
     use verified TLS and the supported endpoint; never disable certificate checks.
   - TLS certificate codes/TLS_VERIFICATION_FAILED: confirm hostname and trusted
     certificate chain; use the official endpoint. Do not use rejectUnauthorized=false.
   - 42501: selected role lacks schema/table permissions. Use the database owner
     role intended for this application, or have the database administrator review
     and grant only the needed privileges. Do not delete/recreate the database.
   - 55P03: schema/advisory lock contention. Inspect active migration/DDL sessions
     with the database administrator; do not kill unknown sessions blindly.
   - 57014: statement timeout. Inspect database load/blocked statements.
   - 53300: too many connections. Review database connection usage and service count.
   - SCHEMA_FILE_MISSING: image packaging; ensure current Dockerfile/context/build.
   - DB_READINESS_FAILED: failure is unclassified; report the safe stage/code for
     further diagnosis, without sharing raw connection strings.
5. From Render's supported database console/psql connection, the administrator can
   run these read-only checks (do not print the connection URL):

   ```sql
   SELECT version(), current_user, current_database(), current_schema();
   SELECT has_database_privilege(current_user, current_database(), 'CONNECT');
   SELECT has_schema_privilege(current_user, current_schema(), 'USAGE'),
          has_schema_privilege(current_user, current_schema(), 'CREATE');
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = current_schema() ORDER BY table_name;
   ```

   Initialization requires CONNECT, schema USAGE/CREATE and ownership/appropriate
   rights for existing schema objects. Normal operation additionally requires
   application table SELECT/INSERT/UPDATE/DELETE. A SELECT 1 alone cannot prove
   schema initialization permissions. Do not run db:migrate-postgres: it is an
   explicit SQLite import tool, not the startup prerequisite.

6. Retry deployment after fixing the indicated setting. Require /api/health HTTP
   200 and ok=true. Do not switch the health path to a static page to hide failure.

The local test environment has no Render credentials or binding to the real
Render database. Local PostgreSQL tests cannot determine which error the real
Render endpoint returns; the new safe logs are needed to establish that cause.

Readiness-fix verification: 204 tests passed with PostgreSQL 18.6; lint, type
checking, formatting and final Docker production build passed. Final Bootstrap
containers returned 200 for a healthy database, 503/ECONNREFUSED for an unreachable
endpoint, 503/42501 for missing schema privileges, and 503/TLS_UNSUPPORTED for a
non-TLS endpoint. Combined stdout/stderr logs were checked for absence of fixture
passwords and connection strings. Bootstrap protected routes still returned 503.
Integration tests repeated permission failures 12 times without pool exhaustion,
verified lock timeouts and successful retry, and preserved an existing row across
schema reinitialization. No real Render database or Shopify data was accessed.

## Render private PostgreSQL transport (self-signed certificate errors)

The previous configuration forced TLS with certificate verification on every
non-loopback host, including Render's short private database hostname. On an
internal endpoint presenting a self-signed certificate this fails during connect
with DEPTH_ZERO_SELF_SIGNED_CERT. Same-region placement alone does not select the
internal URL, and that error alone cannot identify which URL is configured.

For this Web Service and database in Frankfurt, check these settings yourself:

1. Open the database's Connections panel and copy **Internal Database URL** into
   the Web Service's DATABASE_URL securely. It should use a short hostname shaped
   like dpg-<identifier>-a, not the external dotted hostname. Do not share the URL.
2. Add DATABASE_SSL_MODE=render-internal. This explicitly selects PostgreSQL's
   private-network non-TLS connection, rather than accepting an untrusted TLS
   certificate. The app permits it only when Render supplies RENDER=true and the
   URL has a short dpg-...-<letter> hostname and default PostgreSQL port 5432.
   Do not manually set RENDER outside Render to bypass this guard.
3. Use the internal URL as provided, without SSL query parameters. Remove any
   appended ssl, sslmode, sslcert, sslkey, sslrootcert or uselibpqcompat options;
   contradictory parameters are rejected rather than silently overriding them.
4. Keep NODE_ENV=production, DZ_BOOTSTRAP_MODE=1, the existing encryption key,
   media settings and /api/health unchanged. Do not set NODE_TLS_REJECT_UNAUTHORIZED=0
   or disable verification globally. Manually deploy the latest main commit.
5. Require health HTTP 200/ok=true. The app still returns 503 when connection,
   permissions or schema readiness fail; private transport does not bypass these.

If you intentionally use an External Database URL instead, leave
DATABASE_SSL_MODE unset (or set verify-full). Verified TLS remains mandatory;
use an endpoint whose certificate matches its hostname and chains to a trusted
CA. Where Render supplies an official private CA, mount it securely and configure
Node's NODE_EXTRA_CA_CERTS before process startup. Do not trust a certificate merely
because it was obtained from the failed handshake. No custom CA was available or
installed in this task.

Production preflight, the normal pg pool and the health pg pool now share one
transport policy. The internal override is explicit ssl=false on a narrowly
validated private endpoint; no rejectUnauthorized:false setting is used. Tests
inspect the real pg Client's effective SSL setting, including PGSSLMODE=require,
and reject external hosts, non-Render runtimes and conflicting URL options.

The agent cannot inspect the actual Render environment binding or connect to its
real database. Render's documentation URL returned HTTP 403 in this environment;
the endpoint and private-network choice must be confirmed in Render's Connections
panel. No Render database records were modified by this task.

Transport-fix verification: 207 tests passed with isolated PostgreSQL 18.6;
Docker production build, lint, type checking and formatting passed. The production
container with explicit guarded internal transport returned health 200 and passed
its Docker health command; Bootstrap routes remained 503. A control container
without the override returned health 503/TLS_UNSUPPORTED against the same non-TLS
fixture, confirming no automatic TLS downgrade. The isolated test database had
zero orders. These checks do not validate the actual Render URL or certificate.
