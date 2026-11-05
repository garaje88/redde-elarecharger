// MapLibre 6 runs its tile parser in a module worker that Next's bundler does not emit, so it is
// served as a static file named after the installed version (see features/trip/trip-map.tsx).
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const target = join(import.meta.dirname, "..", "public", "vendor");
mkdirSync(target, { recursive: true });
copyFileSync(
  join(dirname(pkgPath), "dist", "maplibre-gl-worker.mjs"),
  join(target, `maplibre-gl-worker-${version}.mjs`),
);
