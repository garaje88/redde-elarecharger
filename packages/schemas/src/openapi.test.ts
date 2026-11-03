import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi";

describe("buildOpenApiDocument", () => {
  const doc = buildOpenApiDocument("1.2.3");

  it("declares OpenAPI 3.1 and the server version", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.version).toBe("1.2.3");
  });

  it("documents the system endpoints", () => {
    expect(Object.keys(doc.paths ?? {})).toEqual(expect.arrayContaining(["/health", "/meta"]));
  });

  it("requires bearer auth on /health", () => {
    expect(doc.paths?.["/health"]?.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components?.schemas).toHaveProperty("ProblemDetails");
  });
});
