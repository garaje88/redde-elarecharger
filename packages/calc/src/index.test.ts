import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "./index";

describe("engine version", () => {
  it("is a semver string", () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
