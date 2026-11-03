import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/garage", "/garage"],
    ["/trip?from=home#map", "/trip?from=home#map"],
  ])("keeps internal path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "garage",
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/%5C%5Cevil.com",
    "/\t/evil.com",
  ])("falls back to / for %s", (input) => {
    const result = safeRedirectPath(input);
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
    expect(new URL(result, "http://app.test").origin).toBe("http://app.test");
  });
});
