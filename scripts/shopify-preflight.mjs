// Reads runtime configuration only. Never prints credentials or contacts Shopify.
const issues = [];
const required = [
  "SHOPIFY_SHOP",
  "SHOPIFY_CLIENT_ID",
  "SHOPIFY_CLIENT_SECRET",
  "SHOPIFY_REDIRECT_URI",
  "INTEGRATIONS_ENCRYPTION_KEY",
];
for (const name of required)
  if (!process.env[name]?.trim()) issues.push(`${name}: missing`);
if (
  process.env.INTEGRATIONS_ENCRYPTION_KEY &&
  !/^[a-f0-9]{64}$/i.test(process.env.INTEGRATIONS_ENCRYPTION_KEY)
)
  issues.push(
    "INTEGRATIONS_ENCRYPTION_KEY: expected 32 bytes encoded as 64 hex characters",
  );
if (process.env.SHOPIFY_REDIRECT_URI) {
  try {
    const url = new URL(process.env.SHOPIFY_REDIRECT_URI);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/api/integrations/shopify/callback"
    )
      throw new Error();
  } catch {
    issues.push(
      "SHOPIFY_REDIRECT_URI: expected HTTPS origin + /api/integrations/shopify/callback",
    );
  }
}
if (
  process.env.SHOPIFY_SHOP &&
  !/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(process.env.SHOPIFY_SHOP)
)
  issues.push("SHOPIFY_SHOP: expected a myshopify.com hostname");
if (
  process.env.DZ_LOCAL_DEMO === "1" ||
  process.env.DZ_DISABLE_EXTERNAL_INTEGRATIONS === "1"
)
  issues.push(
    "Local demo disables live integrations; use the separate npm run dev workflow",
  );
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Shopify configuration shape OK. Live authorization and installation are not verified.",
  );
}
