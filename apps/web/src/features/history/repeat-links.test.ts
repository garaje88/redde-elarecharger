import { describe, expect, it } from "vitest";
import {
  chargeRepeatHref,
  parseChargeParams,
  parseTripParams,
  tripRepeatHref,
} from "./repeat-links";

const id = "0b8f6a4e-0000-4000-8000-0000000000aa";

describe("repeat links", () => {
  it("round-trips a charge calculation", () => {
    const href = chargeRepeatHref({
      vehicle_id: id,
      charger_id: id,
      start_soc: 20,
      target_soc: 80,
    });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseChargeParams(params)).toEqual({
      vehicleId: id,
      chargerId: id,
      start: 20,
      target: 80,
    });
  });

  it("drops an inverted or out-of-range SoC", () => {
    expect(parseChargeParams({ start: "80", target: "20" })).toMatchObject({
      start: undefined,
      target: undefined,
    });
    expect(parseChargeParams({ start: "x", target: "200" })).toMatchObject({ start: undefined });
  });

  it("round-trips a trip with its options", () => {
    const href = tripRepeatHref({
      vehicle_id: id,
      origin: { lat: 4.711, lng: -74.0721, label: "Bogotá" },
      destination: { lat: 4.303, lng: -74.803, label: "Girardot" },
      options: {
        start_soc: 80,
        passengers: 2,
        cargo_kg: 40,
        air_conditioning: true,
        style: "eco",
        outside_temp_c: 28,
        reserve_pct: 10,
      },
    });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseTripParams(params)).toEqual({
      vehicleId: id,
      origin: { lat: 4.711, lng: -74.0721, label: "Bogotá" },
      destination: { lat: 4.303, lng: -74.803, label: "Girardot" },
      options: {
        start_soc: 80,
        passengers: 2,
        cargo_kg: 40,
        air_conditioning: true,
        style: "eco",
        outside_temp_c: 28,
      },
    });
  });

  it("ignores malformed trip parameters", () => {
    expect(
      parseTripParams({ from: "95,0", to: "a,b", style: "rocket", ac: "maybe", soc: ["1", "2"] }),
    ).toEqual({
      vehicleId: undefined,
      origin: null,
      destination: null,
      options: {},
    });
  });
});
