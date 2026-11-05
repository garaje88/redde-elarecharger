import type { MetadataRoute } from "next";

/** Only the public pages are indexable; the app and the API need a session. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/privacidad", "/terminos", "/acerca"],
      disallow: ["/api/", "/auth/"],
    },
  };
}
