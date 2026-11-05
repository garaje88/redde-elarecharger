"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Route } from "@elacharger/schemas";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import { useEffect, useRef } from "react";
import Map, { Layer, type MapRef, Marker, NavigationControl, Source } from "react-map-gl/maplibre";

// Free OpenStreetMap vector tiles without a key; NEXT_PUBLIC_MAP_STYLE_URL (e.g. MapTiler) wins.
const STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
const BOGOTA = { longitude: -74.0721, latitude: 4.711, zoom: 9 };

// Copied to /vendor by scripts/copy-map-worker.mjs: the bundler does not emit MapLibre's worker.
setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

export interface MapPoint {
  lat: number;
  lng: number;
}

function Pin({ label }: { label: "A" | "B" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-md ${
        label === "A" ? "bg-inverse text-inverse-foreground" : "bg-primary text-primary-foreground"
      }`}
    >
      {label}
    </span>
  );
}

export default function TripMap({
  origin,
  destination,
  route,
  onPick,
  padding,
}: {
  origin: MapPoint | null;
  destination: MapPoint | null;
  route: Route | null;
  onPick: (point: MapPoint) => void;
  /** Space covered by panels, so the route fits in the visible part. */
  padding: { top: number; bottom: number; left: number; right: number };
}) {
  const map = useRef<MapRef>(null);

  useEffect(() => {
    if (!route || !map.current) return;
    const [west, south, east, north] = route.bbox;
    map.current.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: {
          top: padding.top + 40,
          bottom: padding.bottom + 40,
          left: padding.left + 40,
          right: padding.right + 40,
        },
        duration: 600,
      },
    );
  }, [route, padding.top, padding.bottom, padding.left, padding.right]);

  return (
    <Map
      ref={map}
      initialViewState={BOGOTA}
      mapStyle={STYLE}
      style={{ width: "100%", height: "100%" }}
      onClick={(event) => onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng })}
      attributionControl={{ compact: true }}
      cooperativeGestures={false}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {route && (
        <Source
          id="route"
          type="geojson"
          data={{
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route.geometry },
          }}
        >
          <Layer
            id="route-casing"
            type="line"
            paint={{ "line-color": "#ffffff", "line-width": 9 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#0b7a4e", "line-width": 5 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>
      )}
      {origin && (
        <Marker longitude={origin.lng} latitude={origin.lat} anchor="center">
          <Pin label="A" />
        </Marker>
      )}
      {destination && (
        <Marker longitude={destination.lng} latitude={destination.lat} anchor="center">
          <Pin label="B" />
        </Marker>
      )}
    </Map>
  );
}
