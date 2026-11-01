import { describe, expect, it } from "vitest";
import type { StoredOrder } from "../src/modules/orders/repository";
import { overviewData } from "../src/components/overview/model";
const order = (
  createdAt: string,
  status = "submitted",
  method = "home",
  totalMinor = 450000,
) =>
  ({
    createdAt,
    status,
    customer: { method },
    quote: { methods: { [method]: { totalMinor } } },
  }) as StoredOrder;
describe("overview reporting", () => {
  const now = new Date("2026-11-01T12:00:00.000Z");
  it("counts actual statuses and excludes cancelled value without treating delivery as payment", () => {
    const data = overviewData(
      [
        order("2026-11-01T09:00:00Z"),
        order("2026-10-31T09:00:00Z", "fulfilled", "office", 400000),
        order("2026-10-31T10:00:00Z", "cancelled"),
      ],
      "all",
      now,
    );
    expect(data.selected).toHaveLength(3);
    expect(data.value).toBe(850000);
    expect(data.pending).toBe(1);
    expect(data.fulfilled).toBe(1);
    expect(data.series.at(-2)?.count).toBe(2);
  });
  it("uses inclusive UTC day boundaries and excludes future or invalid dates", () => {
    const data = overviewData(
      [
        order("2026-10-26T00:00:00Z"),
        order("2026-10-25T23:59:59Z"),
        order("2026-11-01T11:59:59Z"),
        order("2026-11-02T00:00:00Z"),
        order("invalid"),
      ],
      "7",
      now,
    );
    expect(data.selected).toHaveLength(2);
    expect(data.series).toHaveLength(7);
    expect(data.series[0]).toEqual({ date: "2026-10-26", count: 1 });
    expect(data.series.at(-1)).toEqual({ date: "2026-11-01", count: 1 });
  });
  it("keeps lifetime metrics distinct from the recent chart and handles empty stores", () => {
    expect(
      overviewData([order("2025-01-01T00:00:00Z")], "all", now).selected,
    ).toHaveLength(1);
    expect(
      overviewData([order("2025-01-01T00:00:00Z")], "30", now).selected,
    ).toHaveLength(0);
    const empty = overviewData([], "30", now);
    expect(empty.value).toBe(0);
    expect(empty.series).toHaveLength(30);
    expect(empty.series.every((day) => day.count === 0)).toBe(true);
  });
});
