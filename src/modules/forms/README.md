# Form design and checkout policy

`settings.ts` defines version-compatible defaults for compact layout, visible sections, text, colors, field order, contact requirements, product binding and delivery choices. Old designs keep their text and colors while new options receive defaults.

`repository.ts` reads the authenticated merchant settings through the shared storage adapter. GET form-config exposes only public design; POST requires private session authorization, same-origin requests, validated IDs and a valid fixed location when geography is hidden.

`policy.ts` and checkout schema builders enforce visibility and requirements on actual order submission. Hidden contacts must be empty; optional contacts may be empty but otherwise require valid values. Hidden quantity is fixed at one. Hidden location uses a validated fixed wilaya and commune. A single allowed delivery method masks the other server-side; policy changes invalidate quotes. Request validation and atomic order pricing use the same policy snapshot.

The studio preview cannot submit orders. Saved designs refresh in open storefront tabs using the existing cross-tab notification mechanism. Financial calculations, inventory transactions and idempotency remain server-side.
