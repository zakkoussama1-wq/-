import { CustomerPreview } from "@/components/customer-preview";
export default async function FormPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string | string[];
    store?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const productId = Array.isArray(query.product) ? "" : query.product;
  return (
    <main className="storefront-page mx-auto w-full max-w-[480px] px-3 py-5 sm:py-8">
      <CustomerPreview
        key={JSON.stringify([query.product, query.store])}
        productId={productId}
      />
    </main>
  );
}
