// Google encoded polyline (precision 5): compact storage for trip_calculations.route_polyline.

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

/** Encodes [lng, lat] pairs. */
export function encodePolyline(points: readonly (readonly [number, number])[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  for (const [lng, lat] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    out += encodeValue(latE5 - lastLat) + encodeValue(lngE5 - lastLng);
    lastLat = latE5;
    lastLng = lngE5;
  }
  return out;
}
