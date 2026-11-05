import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCsp,
  createNonce,
  SERVICE_WORKER_HEADERS,
  STATIC_SECURITY_HEADERS,
} from "./security-headers";

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

describe("public/_headers (Cloudflare static files)", () => {
  // Rules of the form "/path\n  Name: value", keyed by path.
  const rules = new Map<string, string[]>();
  let current: string[] = [];
  for (const line of readFileSync(join(import.meta.dirname, "../../public/_headers"), "utf8").split(
    "\n",
  )) {
    if (line.startsWith("/")) rules.set(line.trim(), (current = []));
    else if (line.startsWith("  ")) current.push(line.trim());
  }
  const lines = (headers: { key: string; value: string }[]) =>
    headers.map(({ key, value }) => `${key}: ${value}`);

  it("repeats the security headers for every file", () => {
    expect(rules.get("/*")).toEqual(lines(STATIC_SECURITY_HEADERS));
  });

  it("repeats the service worker headers", () => {
    expect(rules.get("/sw.js")).toEqual(lines(SERVICE_WORKER_HEADERS));
  });
});
