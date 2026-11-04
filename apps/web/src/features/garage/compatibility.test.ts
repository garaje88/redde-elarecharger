import { describe, expect, it } from "vitest";
import { connectorCompatibility } from "./compatibility";

const connectors = [
  { code: "TYPE1" as const, compatible_adapters: ["NACS" as const] },
  { code: "TYPE2" as const, compatible_adapters: [] },
  { code: "NACS" as const, compatible_adapters: ["TYPE1" as const, "CCS1" as const] },
];

describe("connectorCompatibility", () => {
  it("classifies direct, adapter and incompatible plugs", () => {
    expect(connectorCompatibility("TYPE2", "TYPE2", connectors)).toBe("compatible");
    expect(connectorCompatibility("TYPE1", "NACS", connectors)).toBe("adapter");
    expect(connectorCompatibility("NACS", "TYPE1", connectors)).toBe("adapter");
    expect(connectorCompatibility("TYPE2", "TYPE1", connectors)).toBe("incompatible");
    expect(connectorCompatibility(null, "TYPE1", connectors)).toBe("unknown");
  });
});
