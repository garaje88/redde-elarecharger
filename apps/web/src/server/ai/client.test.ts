import { describe, expect, it } from "vitest";
import { addUsage, estimateCostUsd } from "./client";

describe("estimateCostUsd", () => {
  it("prices input and output per million tokens", () => {
    expect(
      estimateCostUsd("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 }),
    ).toBe(3);
  });

  it("counts cache writes at 1.25× and reads at 0.1× of input, and web searches", () => {
    expect(
      estimateCostUsd("claude-opus-5-5", {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 1_000_000,
        cache_read_input_tokens: 1_000_000,
        server_tool_use: { web_search_requests: 3 },
      }),
    ).toBeCloseTo(5 + 0.4 + 0.03, 6);
  });

  it("prices unknown models as the most expensive one", () => {
    expect(estimateCostUsd("claude-new", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(10);
  });
});

describe("addUsage", () => {
  it("adds every counter", () => {
    expect(
      addUsage(
        { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3 },
        { input_tokens: 10, output_tokens: 20, server_tool_use: { web_search_requests: 1 } },
      ),
    ).toEqual({
      input_tokens: 11,
      output_tokens: 22,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 3,
      server_tool_use: { web_search_requests: 1 },
    });
  });
});
