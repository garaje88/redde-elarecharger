import type { NextConfig } from "next";
import { SERVICE_WORKER_HEADERS, STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The nonce CSP is set per request in src/proxy.ts; these apply to every response the server
  // renders. On Cloudflare, static files skip the server: public/_headers repeats them.
  async headers() {
    return [
      { source: "/:path*", headers: STATIC_SECURITY_HEADERS },
      { source: "/sw.js", headers: SERVICE_WORKER_HEADERS },
    ];
  },
  transpilePackages: [
    "@elacharger/api-client",
    "@elacharger/calc",
    "@elacharger/schemas",
    "@elacharger/types",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
