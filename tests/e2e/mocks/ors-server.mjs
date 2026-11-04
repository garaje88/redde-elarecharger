// Simulated OpenRouteService for E2E (docs/PLAN.md phase 5: "ORS simulado"). The app reaches it
// through ORS_BASE_URL; responses come from tests/fixtures/ors.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const directions = JSON.parse(
  readFileSync(new URL("../../fixtures/ors/directions.json", import.meta.url)),
);
const places = JSON.parse(readFileSync(new URL("../../fixtures/ors/places.json", import.meta.url)));
const port = Number(process.env.ORS_MOCK_PORT ?? 3201);

const feature = ({ label, lng, lat }) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { label },
});
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const normalize = (text) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (!req.headers.authorization) return send(res, 401, { error: "missing key" });
  if (url.pathname === "/health") return send(res, 200, { ok: true });
  if (url.pathname === "/v2/directions/driving-car/geojson" && req.method === "POST")
    return send(res, 200, directions);
  if (url.pathname === "/geocode/autocomplete") {
    const text = normalize(url.searchParams.get("text") ?? "");
    const hits = Object.entries(places).filter(([key]) => key.startsWith(text.slice(0, 4)));
    return send(res, 200, {
      type: "FeatureCollection",
      features: hits.map(([, place]) => feature(place)),
    });
  }
  if (url.pathname === "/geocode/reverse") {
    const lat = Number(url.searchParams.get("point.lat"));
    const place = lat > 4.5 ? places.bogota : places.girardot;
    return send(res, 200, { type: "FeatureCollection", features: [feature(place)] });
  }
  return send(res, 404, { error: { code: 2010, message: "Not found" } });
}).listen(port, () => console.log(`ORS mock on ${port}`));
