// Runs after `opennextjs-cloudflare build`, before a deploy. OpenNext copies every value from the
// .env files it finds (app and monorepo root) into the Worker code, and Next inlines the
// NEXT_PUBLIC_* values from them into the browser bundle. A deploy built on a laptop would then
// ship secrets inside the script and point at the local Supabase. Secrets belong in
// `wrangler secret put`; public values in the build environment (docs/DEPLOY.md).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = join(import.meta.dirname, "..");
const problems = [];

const baked = await import(pathToFileURL(join(root, ".open-next/cloudflare/next-env.mjs")).href);
const keys = new Set(
  ["production", "development", "test"].flatMap((mode) => Object.keys(baked[mode] ?? {})),
);
for (const key of keys) {
  if (!key.startsWith("NEXT_PUBLIC_")) problems.push(`${key} copied from a .env file`);
}

const LOCAL = /(?:localhost|127\.0\.0\.1):54321/;
// Next inlines NEXT_PUBLIC_* only when they exist at build time. Missing, the browser bundle keeps
// a `process.env.NEXT_PUBLIC_…` read that is undefined at runtime and sign-in fails silently.
const UNSET_PUBLIC = /\.env\.(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)\b/;
const found = new Set();
const scan = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (!entry.name.endsWith(".js")) continue;
    const code = readFileSync(path, "utf8");
    if (!found.has("local") && LOCAL.test(code)) {
      found.add("local");
      problems.push(`local Supabase URL in ${path.slice(root.length + 1)}`);
    }
    const unset = UNSET_PUBLIC.exec(code)?.[1];
    if (unset && !found.has(unset)) {
      found.add(unset);
      problems.push(`${unset} was not set during the build`);
    }
  }
};
scan(join(root, ".open-next/assets/_next/static"));

if (problems.length > 0) {
  console.error("The Worker build is not safe to deploy:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "Build without .env files (CI or Workers Builds), with only the NEXT_PUBLIC_* variables " +
      "in the environment. See docs/DEPLOY.md.",
  );
  process.exit(1);
}
console.log("Worker build: no secrets from .env files, Supabase URL and key inlined, not local.");
