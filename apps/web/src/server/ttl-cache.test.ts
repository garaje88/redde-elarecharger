import { describe, expect, it, vi } from "vitest";
import { ttlCache } from "./ttl-cache";

vi.mock("server-only", () => ({}));

describe("ttlCache", () => {
  it("shares one call per key until the entry expires", async () => {
    let clock = 0;
    const fn = vi.fn(async (a: number) => a * 2);
    const cached = ttlCache(fn, { ttlMs: 100, maxEntries: 10, now: () => clock });

    expect(await cached(2)).toBe(4);
    expect(await cached(2)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);

    clock = 101;
    await cached(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("never caches a failure", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue("ok");
    const cached = ttlCache(fn as (k: string) => Promise<string>, { ttlMs: 1000, maxEntries: 10 });

    await expect(cached("a")).rejects.toThrow("down");
    expect(await cached("a")).toBe("ok");
  });

  it("evicts the oldest entry beyond the size limit", async () => {
    const fn = vi.fn(async (k: string) => k);
    const cached = ttlCache(fn, { ttlMs: 1000, maxEntries: 2 });

    await cached("a");
    await cached("b");
    await cached("c");
    await cached("a");
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
