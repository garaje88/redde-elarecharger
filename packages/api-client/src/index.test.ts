import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./index";

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(
    async (_input: Request) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

describe("createApiClient", () => {
  it("sends the bearer token to /api/v1", async () => {
    const fetch = fakeFetch({ status: "ok", user_id: "u", time: "t" });
    const client = createApiClient({
      baseUrl: "https://example.test/",
      getAccessToken: () => "token-123",
      fetch,
    });

    const { data } = await client.GET("/health");

    const request = fetch.mock.calls[0]?.[0];
    expect(request?.url).toBe("https://example.test/api/v1/health");
    expect(request?.headers.get("Authorization")).toBe("Bearer token-123");
    expect(data?.status).toBe("ok");
  });

  it("omits the header when signed out", async () => {
    const fetch = fakeFetch({ api_version: "v1", server_version: "0", min_client_version: "0" });
    const client = createApiClient({
      baseUrl: "https://example.test",
      getAccessToken: () => null,
      fetch,
    });

    await client.GET("/meta");

    expect(fetch.mock.calls[0]?.[0].headers.has("Authorization")).toBe(false);
  });
});
