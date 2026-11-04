import { z } from "zod";

export const LatLngSchema = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
  .meta({ id: "LatLng" });

export const PlaceSchema = z
  .object({ label: z.string().max(300), lat: z.number(), lng: z.number() })
  .meta({ id: "Place" });

export const PlaceListSchema = z.object({ items: z.array(PlaceSchema) }).meta({ id: "PlaceList" });

export const GeocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const ReverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const DirectionsRequestSchema = z
  .object({ origin: LatLngSchema, destination: LatLngSchema })
  .meta({ id: "DirectionsRequest" });

export const RouteSegmentSchema = z
  .object({
    distance_km: z.number(),
    duration_min: z.number(),
    ascent_m: z.number(),
    descent_m: z.number(),
  })
  .meta({ id: "RouteSegment" });

export const RouteSchema = z
  .object({
    distance_km: z.number(),
    duration_min: z.number(),
    ascent_m: z.number(),
    descent_m: z.number(),
    /** [lng, lat] pairs for drawing. */
    geometry: z.array(z.tuple([z.number(), z.number()])),
    bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).meta({
      description: "[west, south, east, north]",
    }),
    segments: z
      .array(RouteSegmentSchema)
      .meta({ description: "About 10 km each, for mountain accuracy." }),
  })
  .meta({ id: "Route" });

export type LatLng = z.infer<typeof LatLngSchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Route = z.infer<typeof RouteSchema>;
