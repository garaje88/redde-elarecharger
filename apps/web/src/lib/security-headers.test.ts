import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./security-headers";

const base = {
  nonce: "abc123",
  isDev: false,
  supabaseUrl: "https://xyz.supabase.co",
  mapStyleUrl: "https://tiles.openfreemap.org/styles/liberty",
};

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ");

describe("buildCsp", () => {
  it("only runs scripts carrying the request nonce", () => {
    const csp = buildCsp(base);
    expect(directive(csp, "script-src")).toEqual(["'self'", "'nonce-abc123'", "'strict-dynamic'"]);
    expect(csp).not.toContain("unsafe-eval");
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
  });

  it("allows Supabase (https and realtime), the map host and Sentry", () => {
    const csp = buildCsp({ ...base, sentryDsn: "https://key@o1.ingest.sentry.io/42" });
    expect(directive(csp, "connect-src")).toEqual([
      "'self'",
      "https://xyz.supabase.co",
      "wss://xyz.supabase.co",
      "https://tiles.openfreemap.org",
      "https://o1.ingest.sentry.io",
    ]);
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval in development and skips the https upgrade for a local Supabase", () => {
    const csp = buildCsp({ ...base, isDev: true, supabaseUrl: "http://127.0.0.1:54321" });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });
});

describe("createNonce", () => {
  it("is fresh on every call", () => {
    expect(createNonce()).not.toBe(createNonce());
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
