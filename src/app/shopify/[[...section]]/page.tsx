import "../../embedded.css";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import Script from "next/script";
import { EmbeddedDashboard } from "@/components/embedded/dashboard";
export const dynamic = "force-dynamic";
export default async function ShopifyPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const path = (await params).section ?? [];
  const section = path[0] ?? "builder";
  if (
    path.length > 1 ||
    !["builder", "design", "shipping", "integrations", "settings"].includes(
      section,
    )
  )
    notFound();
  if (process.env.DZ_SHOPIFY_EMBEDDED !== "1" || !process.env.SHOPIFY_CLIENT_ID)
    return (
      <main>
        <h1>DZ Lead Form Pro</h1>
        <p>واجهة Shopify غير مفعلة. راجع إعدادات التطبيق قبل تفعيلها.</p>
      </main>
    );
  const styleText = await readFile(
    join(process.cwd(), "src/storefront/style.css"),
    "utf8",
  );
  return (
    <>
      <meta name="shopify-api-key" content={process.env.SHOPIFY_CLIENT_ID} />
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="afterInteractive"
      />
      <EmbeddedDashboard section={section} styleText={styleText} />
    </>
  );
}
