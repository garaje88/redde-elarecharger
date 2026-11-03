import createClient, { type Middleware } from "openapi-fetch";
import type { components, paths } from "./schema";

export type { components, paths };

export interface ApiClientOptions {
  /** Origin of the backend, e.g. "https://elacharger.app". */
  baseUrl: string;
  /** Returns the current Supabase access token, or null when signed out. */
  getAccessToken?: () => string | null | Promise<string | null>;
  /** Custom fetch, e.g. for tests or React Native polyfills. */
  fetch?: (input: Request) => Promise<Response>;
}

/** Typed client for /api/v1, usable from web and React Native. */
export function createApiClient({ baseUrl, getAccessToken, fetch }: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: `${baseUrl.replace(/\/$/, "")}/api/v1`,
    ...(fetch ? { fetch } : {}),
  });

  if (getAccessToken) {
    const auth: Middleware = {
      async onRequest({ request }) {
        const token = await getAccessToken();
        if (token) request.headers.set("Authorization", `Bearer ${token}`);
        return request;
      },
    };
    client.use(auth);
  }

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
