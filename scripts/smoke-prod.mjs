// Smoke test of a deployed Elacharger (docs/DEPLOY.md, verification). Read-only: it never
// signs in or writes. Usage: node scripts/smoke-prod.mjs https://<your-domain>
const base = (process.argv[2] ?? "").replace(/\/$/, "");
// http://localhost is accepted to try the script itself; production must be https.
if (!/^https:\/\/|^http:\/\/localhost(:\d+)?$/.test(base)) {
  console.error("Usage: node scripts/smoke-prod.mjs https://<your-domain>");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const get = (path, init) => fetch(`${base}${path}`, { redirect: "manual", ...init });

const meta = await get("/api/v1/meta");
check("GET /api/v1/meta answers 200", meta.status === 200, String(meta.status));

const login = await get("/login");
const csp = login.headers.get("content-security-policy") ?? "";
const html = login.status === 200 ? await login.text() : "";
const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
check("/login answers 200", login.status === 200, String(login.status));
check("CSP carries a per-request nonce", !!nonce);
check("the page's scripts carry that nonce", !!nonce && html.includes(`nonce="${nonce}"`));
check("CSP upgrades insecure requests", csp.includes("upgrade-insecure-requests"));
check(
  "CSP has no local Supabase",
  !/127\.0\.0\.1|localhost/.test(csp),
  csp.match(/connect-src[^;]*/)?.[0],
);
check("HSTS on pages", !!login.headers.get("strict-transport-security"));

const second = await get("/login");
const nonce2 = /'nonce-([^']+)'/.exec(second.headers.get("content-security-policy") ?? "")?.[1];
check("the nonce changes per request", !!nonce2 && nonce2 !== nonce);

const icon = await get("/icons/icon-192.png");
check("static files answer 200", icon.status === 200, String(icon.status));
check("static files carry HSTS (public/_headers)", !!icon.headers.get("strict-transport-security"));

const sw = await get("/sw.js");
check("service worker is never cached", /no-cache/.test(sw.headers.get("cache-control") ?? ""));
check("service worker has its own CSP", !!sw.headers.get("content-security-policy"));

for (const path of ["/manifest.webmanifest", "/robots.txt", "/privacidad", "/terminos"]) {
  const response = await get(path);
  check(`${path} answers 200`, response.status === 200, String(response.status));
}

const privacy = await (await get("/privacidad")).text();
check(
  "the privacy notice has a contact (Ley 1581)",
  !privacy.includes("se publicará antes del lanzamiento"),
  "set NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL",
);

const garage = await get("/garage");
check(
  "signed-out pages redirect to /login",
  [302, 303, 307].includes(garage.status) &&
    (garage.headers.get("location") ?? "").includes("/login"),
  String(garage.status),
);

const api = await get("/api/v1/vehicles");
check("the API answers 401 without a session", api.status === 401, String(api.status));
check(
  "API errors are problem+json",
  (api.headers.get("content-type") ?? "").includes("application/problem+json"),
);

const openapi = await get("/api/v1/openapi.json");
check("OpenAPI is published", openapi.status === 200, String(openapi.status));

let failed = 0;
for (const { name, ok, detail } of results) {
  if (!ok) failed += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` (${detail})` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed for ${base}`);
process.exit(failed > 0 ? 1 : 0);
