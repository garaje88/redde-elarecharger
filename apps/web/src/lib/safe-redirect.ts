const FALLBACK = "/";

/**
 * Returns `path` only when it is an internal path of this app, so `?next=` cannot be used
 * as an open redirect (e.g. "//evil.com", "/\\evil.com", "https://evil.com").
 */
export function safeRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return FALLBACK;
  }
  try {
    const base = "http://internal.invalid";
    const url = new URL(path, base);
    if (url.origin !== base) return FALLBACK;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK;
  }
}
