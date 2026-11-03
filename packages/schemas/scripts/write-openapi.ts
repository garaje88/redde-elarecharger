import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildOpenApiDocument } from "../src/openapi";

const out = process.argv[2];
if (!out) {
  console.error("Usage: write-openapi <output.json>");
  process.exit(1);
}
writeFileSync(resolve(out), `${JSON.stringify(buildOpenApiDocument("0.0.0"), null, 2)}\n`);
