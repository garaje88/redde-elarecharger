import { describe, expect, it } from "vitest";
import { MemoryLimiter, enforceRateLimit } from "./rate-limit";

describe("enforceRateLimit", () => {
  it("answers 429 with Retry-After once the window is full, then recovers", async () => {
    let now = 1_000_000;
    const limiter = new MemoryLimiter(() => now);
    const limits = [{ name: "test", max: 2, windowSec: 60 }];

    await enforceRateLimit("ana", limits, limiter);
    await enforceRateLimit("ana", limits, limiter);
    await expect(enforceRateLimit("ana", limits, limiter)).rejects.toMatchObject({
      status: 429,
      headers: { "Retry-After": "60" },
    });
    await enforceRateLimit("beto", limits, limiter);

    now += 61_000;
    await expect(enforceRateLimit("ana", limits, limiter)).resolves.toBeUndefined();
  });
});
