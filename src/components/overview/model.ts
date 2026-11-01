import type { StoredOrder } from "@/modules/orders/repository";
export const orderAmount = (order: StoredOrder) =>
  order.quote.methods[order.customer.method].totalMinor ?? 0;
export function overviewData(orders: StoredOrder[], range: string, now: Date) {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const days = range === "30" ? 30 : 7;
  const dayMs = 86400000;
  const start = today - (days - 1) * dayMs;
  const selected = orders.filter((order) => {
    const time = Date.parse(order.createdAt);
    return (
      Number.isFinite(time) &&
      time <= now.getTime() &&
      (range === "all" || time >= start)
    );
  });
  return {
    selected,
    value: selected
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + orderAmount(o), 0),
    pending: selected.filter((o) => o.status === "submitted").length,
    fulfilled: selected.filter((o) => o.status === "fulfilled").length,
    series: Array.from({ length: days }, (_, index) => {
      const date = new Date(start + index * dayMs).toISOString().slice(0, 10);
      return {
        date,
        count: selected.filter((o) => o.createdAt.slice(0, 10) === date).length,
      };
    }),
  };
}
