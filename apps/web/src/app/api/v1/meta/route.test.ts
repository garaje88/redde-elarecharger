import { MetaResponseSchema } from "@elacharger/schemas";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/v1/meta", () => {
  it("is public and matches its contract", async () => {
    const response = await GET(new NextRequest("http://localhost/api/v1/meta"), undefined);

    expect(response.status).toBe(200);
    expect(MetaResponseSchema.parse(await response.json()).api_version).toBe("v1");
  });
});
