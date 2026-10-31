# تحديث بعد المرحلة الخامسة

نموذج العميل يستخدم الآن `/api/orders` ويحفظ طلبًا فعليًا. مسار التحقق القديم ما زال دون حفظ. المرجع الحالي هو README.md وIMPLEMENTATION_STATUS.md في جذر المشروع؛ ما يلي يوثق مرحلة التحقق السابقة ولا يصف الحفظ الحالي.

# COD checkout — Phase 4

Implemented a real pricing and validation flow. It deliberately does not create or store orders; that is Phase 5. No conversion events are emitted.

- `schema.ts`: strict shared Zod schemas for customer, quantity, geographic IDs, product/variant IDs and discount configuration. Algerian mobile formats `0[567]…`, `+213…` and `00213…` normalize to a national number; Arabic and Persian digits normalize to ASCII. Home requires a usable address, office does not. Unknown fields (client totals, merchant IDs, fake offices) are rejected.
- `repository.ts`: persistent merchant-scoped local product fixtures and merchant discount in `data/checkout.sqlite`. Uses additive table creation, transactional updates, optimistic discount revision, no user/customer data. The first catalog access seeds an explicitly marked DEMO bag with two variants, 3,900 and 4,200 DZD. These are test fixtures, not real inventory or Shopify products. Existing catalog rows are never overwritten by reads or geography seeding. Full product CRUD and stock management are not implemented.
- `money.ts`: shared integer-centime subtotal and capped product discount; fixed discount in centimes, percentage in basis points, half-up percentage rounding. Shipping is never discounted.
- `service.ts`: `priceCheckout` reads canonical product and discount and one shipping snapshot; uses the authoritative shipping module for both methods and validates actual geographic parent relationships. Returns canonical unit price, subtotal, discount and method totals. `validateCheckout` validates customer fields, recalculates prices, checks method availability and detects outdated quotes. Phase 5 must reuse this server pricing and implement transactional order persistence, inventory handling and server-side idempotency.
- `http.ts`: same-origin JSON POST, limited body, useful Arabic 400/403/409/413/415/422/503 responses, no-store data. No PII is written to storage or application logs. The platform's external HTTP infrastructure is outside this application's storage guarantee.

`quoteToken` is an unkeyed content digest of merchant-bound inputs, canonical prices and settings revisions. It is an optimistic stale-price detector, not authentication, a payment authorization, a signature or an idempotency token. The server never accepts browser-calculated totals, whether or not a digest is supplied. Confirmation response is `validated: true, persisted: false` with a clear Arabic explanation and no fictitious order ID.

Frontend:

- `/form`: standalone customer interface; embedded in dashboard too.
- `customer-preview.tsx`: React Hook Form, shared Zod validation, available-method controls, conditional address, live subtotal/discount/shipping/total, canonical server result displayed before confirmation, loading/retry/error/success.
- `checkout/use-checkout.ts`: debounced quote requests, abort superseded requests and bind responses to exact input and location keys. A previously known rate can show provisional totals immediately for quantity/variant changes, but confirmation stays disabled until fresh server pricing is available. New locations never reuse the old location's rate.
- `checkout/discount-settings.tsx`: persistent discount editor in dashboard Settings. Merchant shipping/discount saves refresh the embedded checkout. External settings changes are caught by server confirmation and return 409; the customer must review and explicitly confirm again.

Office delivery uses only explicitly enabled generic office mode and a valid office shipping rate. There is no office list until real office data exists. 69-mode retains the geographic source verification warning. The server-local merchant context remains development-only; there is no login or production tenant authorization yet.

`CHECKOUT_DATABASE_PATH` selects a separate absolute storage path. Never delete it when reseeding geography. Browser tests use `PLAYWRIGHT_CHECKOUT_DATABASE_PATH` or a separate temporary file; one worker prevents local merchant settings tests from overwriting each other's revisions. Use demo customer details in local testing.
