import { StorefrontError } from "./context";
/** Bounded per-process, per-shop budget; never stores IP addresses or customer data. */
export function createReadBudget(limit = 180, clock = () => Date.now()) {
  const windows = new Map<string, { count: number; expires: number }>();
  return (shop: string) => {
    const now = clock();
    let window = windows.get(shop);
    if (!window || window.expires <= now) {
      if (windows.size >= 1024) {
        for (const [key, value] of windows)
          if (value.expires <= now) windows.delete(key);
        if (windows.size >= 1024)
          throw new StorefrontError("RATE_LIMITED", 429);
      }
      window = { count: 0, expires: now + 60000 };
      windows.set(shop, window);
    }
    if (window.count >= limit) throw new StorefrontError("RATE_LIMITED", 429);
    window.count++;
  };
}
export const consumeReadBudget = createReadBudget();
