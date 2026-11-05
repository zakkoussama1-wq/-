export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.DZ_SHOPIFY_ORDER_SYNC === "1"
  ) {
    const { startOrderSyncWorker } =
      await import("./modules/orders/shopify/worker");
    startOrderSyncWorker();
  }
}
