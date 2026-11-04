import { describe, expect, it } from "vitest";
import { encodePolyline } from "./polyline";

describe("encodePolyline", () => {
  it("matches Google's reference example", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    expect(
      encodePolyline([
        [-120.2, 38.5],
        [-120.95, 40.7],
        [-126.453, 43.252],
      ]),
    ).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(encodePolyline([])).toBe("");
  });
});
