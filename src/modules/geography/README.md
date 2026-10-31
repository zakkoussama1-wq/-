# Geographic module — Phase 2

Local persistence: SQLite via Node.js 24's built-in `node:sqlite`, no account or service required. The geography catalog is public, shared reference data, not tenant-owned business data. Merchant products, shipping and orders remain unimplemented. PostgreSQL/Prisma integration for business persistence remains future work; this SQLite store does not claim production PostgreSQL support.

- `repository.ts`: read-only parameterized database queries, no browser SQL access.
- `http.ts`, `schema.ts`: validated API requests and explicit 400/503 failures.
- `normalize.mjs`: shared importer/server search folding; never rewrites display names.
- `selection.ts`: dependent selection state; clears commune on wilaya/mode changes.
- `../../components/geography-fields.tsx`: debounced API search, cancellation of obsolete requests, loading, empty and retry states.
- `../../../data/geography`: pinned sources, licenses, crosswalk, generated catalog and audit.

Regenerate with `npm run geo:import`; verify with `npm run geo:check`; recreate the database with `npm run db:seed`. Read `data/geography/README.md` before updating the datasets. No network is used for import, seed or normal application usage.

69-mode data is reconciled against a secondary transcription, with a visible warning. Direct official-journal verification remains pending network access. Do not silently remove this warning or promote the data to official status.
