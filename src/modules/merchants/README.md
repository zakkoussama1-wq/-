# merchants

Tenant context is resolved from a server session and an active Shopify installation bound to the stable Admin API Shop GID. Production rejects missing identity and mismatched store selectors. Development fixtures remain explicit and separate. See ../../../docs/MULTITENANT-STAGE-2.md for schema, the internal encrypted provider vault, tests and production limitations.
