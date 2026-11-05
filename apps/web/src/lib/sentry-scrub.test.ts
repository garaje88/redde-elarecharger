import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent, scrubString } from "./sentry-scrub";

describe("scrubString", () => {
  it("removes emails, coordinates and bearer tokens", () => {
    expect(
      scrubString("ana@gmail.com went from 4.711234,-74.072112 with Bearer eyJhbGciOi.abc-def"),
    ).toBe("[email] went from [coord],[coord] with Bearer [token]");
  });

  it("keeps ordinary numbers", () => {
    expect(scrubString("charged 37.4 kWh to 80 % in 340.5 min")).toBe(
      "charged 37.4 kWh to 80 % in 340.5 min",
    );
  });
});

describe("scrubEvent", () => {
  it("keeps only the user id and the path of the request", () => {
    const event = scrubEvent({
      message: "Route failed for beto@example.com",
      user: { id: "u-1", email: "beto@example.com", ip_address: "1.2.3.4" },
      request: {
        url: "https://elacharger.app/api/v1/routing/reverse?lat=4.7110&lng=-74.0721",
        method: "GET",
        headers: { cookie: "sb=secret", authorization: "Bearer x" },
        data: '{"origin":{"lat":4.7}}',
        query_string: "lat=4.7110",
      },
    });
    expect(event).toEqual({
      message: "Route failed for [email]",
      user: { id: "u-1" },
      request: { url: "https://elacharger.app/api/v1/routing/reverse", method: "GET" },
    });
  });

  it("filters sensitive keys anywhere in extra data", () => {
    const event = scrubEvent({
      extra: { body: { origin: { lat: 4.7, lng: -74 }, energy_kwh: 12.5 }, notes: "casa" },
      exception: { values: [{ value: "near 6.244203, -75.581211" }] },
    });
    expect(event).toEqual({
      extra: { body: { origin: "[filtered]", energy_kwh: 12.5 }, notes: "[filtered]" },
      exception: { values: [{ value: "near [coord], [coord]" }] },
    });
  });
});

describe("scrubBreadcrumb", () => {
  it("drops query strings from fetch and navigation breadcrumbs", () => {
    expect(
      scrubBreadcrumb({
        category: "fetch",
        data: { url: "/api/v1/routing/geocode?text=calle+10&lat=4.71", status_code: 200 },
      }),
    ).toEqual({ category: "fetch", data: { url: "/api/v1/routing/geocode", status_code: 200 } });
  });
});
