"use client";

import { CalcInputError } from "@elacharger/calc";
import type {
  DrivingStyle,
  Place,
  Profile,
  Route,
  TripOptions,
  Vehicle,
} from "@elacharger/schemas";
import { ArrowUpDown, ChevronDown, ChevronUp, LocateFixed, Minus, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { durationLabel } from "@/features/charge/explain";
import { BatteryRing } from "@/features/trip/battery-ring";
import { estimateTripForSetup, tripStatus } from "@/features/trip/estimate";
import { PlaceSearch } from "@/features/trip/place-search";
import { api, apiErrorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";

const TripMap = dynamic(() => import("@/features/trip/trip-map"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="size-full animate-pulse bg-muted" />,
});

type Field = "origin" | "destination";

const STYLES: { value: DrivingStyle; label: string }[] = [
  { value: "eco", label: "Eco" },
  { value: "normal", label: "Normal" },
  { value: "sport", label: "Deportivo" },
];

const STATUS_TEXT = {
  ok: (reserve: number) => `Llegas con reserva de sobra (mínimo ${reserve} %)`,
  tight: (reserve: number) => `Llegas justo: cerca de tu reserva de ${reserve} %`,
  short: (reserve: number) =>
    `No llegas con tu reserva de ${reserve} %: planea una parada para cargar`,
};

const pill = (selected: boolean) =>
  `min-h-11 rounded-xl border px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
    selected
      ? "border-inverse bg-inverse text-inverse-foreground"
      : "border-input bg-card hover:border-foreground/40"
  }`;

function routeMessage(status: number | undefined) {
  if (status === 503)
    return "Las rutas no están disponibles: falta configurar OpenRouteService o el servicio no responde.";
  if (status === 404) return "No encontramos una ruta en carro entre esos puntos.";
  return apiErrorMessage(status);
}

export function TripPlanner({ vehicles, profile }: { vehicles: Vehicle[]; profile: Profile }) {
  const [vehicleId, setVehicleId] = useState(
    (vehicles.find((v) => v.is_default) ?? vehicles[0])?.id ?? "",
  );
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [active, setActive] = useState<Field>("origin");
  const [route, setRoute] = useState<Route | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [options, setOptions] = useState<TripOptions>({
    start_soc: 80,
    passengers: 1,
    cargo_kg: 0,
    air_conditioning: false,
    style: "normal",
    outside_temp_c: null,
  });
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];

  const { estimate, problem } = useMemo(() => {
    if (!vehicle || !route || !origin || !destination) return { estimate: null, problem: null };
    try {
      return {
        estimate: estimateTripForSetup({
          vehicle,
          route,
          origin,
          destination,
          options,
          defaultReservePct: profile.reserve_pct,
        }),
        problem: null,
      };
    } catch (error) {
      if (!(error instanceof CalcInputError)) throw error;
      return {
        estimate: null,
        problem:
          error.field === "vehicle.usableKwh"
            ? "Falta la batería útil de tu carro."
            : "Revisa los datos del trayecto.",
      };
    }
  }, [vehicle, route, origin, destination, options, profile.reserve_pct]);

  // The route is fitted into the part of the map the panel leaves visible.
  const desktop = useMediaQuery("(min-width: 1024px)");
  const sheet = useRef<HTMLElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSheetHeight(entry?.contentRect.height ?? 0),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Only the latest route request may update the screen.
  const routeRequest = useRef(0);

  if (!vehicle) return null;

  const loadRoute = async (a: Place | null, b: Place | null) => {
    const request = ++routeRequest.current;
    setRoute(null);
    setRouteError(null);
    if (!a || !b) return;
    setLoadingRoute(true);
    const { data, response } = await api.POST("/routing/directions", {
      body: { origin: { lat: a.lat, lng: a.lng }, destination: { lat: b.lat, lng: b.lng } },
    });
    if (request !== routeRequest.current) return;
    setLoadingRoute(false);
    // OpenAPI renders the [lng, lat] tuples as arrays; the server validated them with Zod.
    setRoute((data as Route | undefined) ?? null);
    if (!data) setRouteError(routeMessage(response.status));
  };

  const setPoint = (field: Field, place: Place) => {
    setStatus(null);
    if (field === "origin") {
      setOrigin(place);
      if (!destination) setActive("destination");
      void loadRoute(place, destination);
    } else {
      setDestination(place);
      void loadRoute(origin, place);
    }
  };

  const pickOnMap = async (point: { lat: number; lng: number }) => {
    const field = active;
    const fallback = {
      ...point,
      label: `${formatNumber(point.lat, 4)}, ${formatNumber(point.lng, 4)}`,
    };
    setPoint(field, fallback);
    const { data } = await api.GET("/routing/reverse", { params: { query: point } });
    if (data) setPoint(field, { ...point, label: data.label });
  };

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (position) =>
        void pickOnMap({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setRouteError("No pudimos leer tu ubicación. Revisa el permiso del navegador."),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
    setActive("origin");
  };

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    void loadRoute(destination, origin);
  };

  const set = <K extends keyof TripOptions>(key: K, value: TripOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));

  const save = () =>
    startSaving(async () => {
      if (!origin || !destination) return;
      const { data, response } = await api.POST("/trip-calculations", {
        body: { vehicle_id: vehicle.id, origin, destination, ...options },
      });
      setStatus(
        data
          ? { kind: "saved", text: "Trayecto guardado." }
          : { kind: "error", text: routeMessage(response.status) },
      );
    });

  const tone = estimate ? tripStatus(estimate) : "ok";
  const net = estimate ? estimate.route.ascent_m - estimate.route.descent_m : 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row-reverse">
      <h1 className="sr-only">Trayecto</h1>
      <div className="fixed inset-0 bottom-20 md:left-24 lg:static lg:inset-auto lg:min-h-dvh lg:flex-1">
        <ErrorBoundary
          fallback={
            <p className="flex size-full items-center justify-center bg-muted p-6 text-center text-sm text-muted-foreground">
              El mapa no está disponible en este navegador; busca las direcciones en el panel.
            </p>
          }
        >
          <TripMap
            origin={origin}
            destination={destination}
            route={route}
            onPick={(point) => void pickOnMap(point)}
            padding={{ top: 40, bottom: desktop ? 0 : sheetHeight, left: 0, right: 0 }}
          />
        </ErrorBoundary>
        <p className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium shadow">
          Toca el mapa para poner {active === "origin" ? "A" : "B"}
        </p>
      </div>

      <section
        ref={sheet}
        aria-label="Planear trayecto"
        className={`fixed inset-x-0 bottom-20 z-30 flex flex-col gap-3 overflow-y-auto rounded-t-3xl bg-background px-4 pt-2 pb-4 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] md:left-24 lg:static lg:max-h-none lg:w-[420px] lg:rounded-none lg:pt-6 lg:shadow-none ${
          expanded ? "max-h-[72dvh]" : "max-h-48"
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-label={expanded ? "Contraer panel" : "Expandir panel"}
          className="mx-auto flex min-h-8 w-20 items-center justify-center rounded-full text-muted-foreground lg:hidden"
        >
          {expanded ? (
            <ChevronDown aria-hidden="true" className="size-5" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-5" />
          )}
        </button>

        <div className="flex flex-col gap-2">
          <PlaceSearch
            label="Punto de salida"
            marker="A"
            value={origin}
            active={active === "origin"}
            onFocus={() => setActive("origin")}
            onSelect={(place) => setPoint("origin", place)}
          />
          <PlaceSearch
            label="Destino"
            marker="B"
            value={destination}
            focus={origin}
            active={active === "destination"}
            onFocus={() => setActive("destination")}
            onSelect={(place) => setPoint("destination", place)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              className={`${pill(false)} flex flex-1 items-center justify-center gap-1.5`}
            >
              <LocateFixed aria-hidden="true" className="size-4" />
              Usar mi ubicación
            </button>
            <button
              type="button"
              onClick={swap}
              disabled={!origin && !destination}
              className={`${pill(false)} flex flex-1 items-center justify-center gap-1.5 disabled:opacity-50`}
            >
              <ArrowUpDown aria-hidden="true" className="size-4" />
              Invertir A y B
            </button>
          </div>
        </div>

        {routeError && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {routeError}
          </p>
        )}

        <div aria-live="polite" className="flex flex-col gap-3">
          {loadingRoute && <p className="text-sm text-muted-foreground">Calculando la ruta…</p>}
          {estimate && !loadingRoute && (
            <article
              aria-label="Resultado del trayecto"
              className="flex flex-col gap-3 rounded-[20px] bg-card p-4"
            >
              <div className="flex items-center gap-4">
                <BatteryRing
                  start={estimate.start_soc}
                  arrival={estimate.arrival_soc}
                  tone={tone}
                />
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Usa</p>
                    <p data-testid="trip-consumed" className="font-heading text-2xl font-semibold">
                      {formatNumber(estimate.consumed_pct, 0)} %
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Llegas con</p>
                    <p
                      data-testid="trip-arrival"
                      className={`font-heading text-2xl font-semibold ${
                        tone === "ok"
                          ? "text-primary"
                          : tone === "tight"
                            ? "text-warning"
                            : "text-destructive"
                      }`}
                    >
                      {formatNumber(estimate.arrival_soc, 0)} %
                    </p>
                  </div>
                </div>
              </div>
              <p
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  tone === "ok"
                    ? "bg-accent text-primary"
                    : tone === "tight"
                      ? "bg-warning/10 text-warning"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {STATUS_TEXT[tone](estimate.reserve_pct)}
              </p>
              <dl className="grid grid-cols-4 gap-2 text-center text-[13px]">
                <div>
                  <dd className="font-semibold">
                    {formatNumber(estimate.route.distance_km, 0)} km
                  </dd>
                  <dt className="text-muted-foreground">distancia</dt>
                </div>
                <div>
                  <dd className="font-semibold">{durationLabel(estimate.route.duration_min)}</dd>
                  <dt className="text-muted-foreground">duración</dt>
                </div>
                <div>
                  <dd className="font-semibold">{formatNumber(estimate.energy_kwh, 1)} kWh</dd>
                  <dt className="text-muted-foreground">energía</dt>
                </div>
                <div>
                  <dd className="font-semibold">
                    {net > 0 ? "+" : net < 0 ? "−" : ""}
                    {formatNumber(Math.abs(net), 0)} m
                  </dd>
                  <dt className="text-muted-foreground">desnivel</dt>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Estimación ±10 %: llegas con {formatNumber(estimate.arrival_soc_range.min, 0)}–
                {formatNumber(estimate.arrival_soc_range.max, 0)} %. Quedan unos{" "}
                {formatNumber(estimate.remaining_range_km, 0)} km de autonomía.
              </p>
              <details className="text-sm">
                <summary className="min-h-6 cursor-pointer font-semibold">
                  ¿Cómo se calculó?
                </summary>
                <dl className="mt-2 flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      Consumo base · {formatNumber(estimate.route.distance_km, 0)} km ×{" "}
                      {formatNumber(estimate.breakdown.base_consumption_kwh_100km, 1)} kWh/100 km
                      {estimate.breakdown.style_factor !== 1 ||
                      estimate.breakdown.air_conditioning_factor !== 1 ||
                      estimate.breakdown.climate_factor !== 1
                        ? " con estilo, A/C, clima y velocidad"
                        : " ajustado por velocidad"}
                    </dt>
                    <dd className="shrink-0 font-semibold">
                      {formatNumber(estimate.breakdown.driving_kwh, 1)} kWh
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      Subidas · +{formatNumber(estimate.route.ascent_m, 0)} m con{" "}
                      {formatNumber(estimate.breakdown.mass_kg, 0)} kg
                      {estimate.breakdown.curb_weight_estimated ? " (peso estimado)" : ""}
                    </dt>
                    <dd className="shrink-0 font-semibold">
                      +{formatNumber(estimate.breakdown.climb_kwh, 1)} kWh
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      Regeneración · −{formatNumber(estimate.route.descent_m, 0)} m
                    </dt>
                    <dd className="shrink-0 font-semibold">
                      −{formatNumber(estimate.breakdown.regen_kwh, 1)} kWh
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-1.5">
                    <dt className="font-semibold">Total estimado (±10 %)</dt>
                    <dd className="shrink-0 font-semibold">
                      {formatNumber(estimate.energy_kwh, 1)} kWh
                    </dd>
                  </div>
                </dl>
              </details>
            </article>
          )}
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}{" "}
              <Link href={`/garage/vehicles/${vehicle.id}`} className="underline">
                Complétala en el garaje
              </Link>
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
          <legend className="sr-only">Opciones del trayecto</legend>
          {vehicles.length > 1 && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Vehículo
              <select
                value={vehicle.id}
                onChange={(event) => setVehicleId(event.target.value)}
                className="min-h-11 rounded-xl border border-input bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nickname}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <label htmlFor="trip-soc" className="text-sm font-medium">
                Batería al salir
              </label>
              <output htmlFor="trip-soc" className="font-heading text-lg font-semibold">
                {options.start_soc} %
              </output>
            </div>
            <input
              id="trip-soc"
              type="range"
              min={1}
              max={100}
              step={1}
              value={options.start_soc}
              aria-valuetext={`${options.start_soc} %`}
              onChange={(event) => set("start_soc", Number(event.target.value))}
              className="h-11 w-full accent-primary"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium" id="passengers-label">
              Personas (con el conductor)
            </span>
            <div
              role="group"
              aria-labelledby="passengers-label"
              className="flex items-center gap-2"
            >
              <button
                type="button"
                aria-label="Una persona menos"
                disabled={options.passengers <= 1}
                onClick={() => set("passengers", options.passengers - 1)}
                className="flex size-11 items-center justify-center rounded-xl border border-input disabled:opacity-40"
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <output aria-live="polite" className="w-6 text-center font-semibold">
                {options.passengers}
              </output>
              <button
                type="button"
                aria-label="Una persona más"
                disabled={options.passengers >= 9}
                onClick={() => set("passengers", options.passengers + 1)}
                className="flex size-11 items-center justify-center rounded-xl border border-input disabled:opacity-40"
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Carga extra (kg)
              <input
                inputMode="decimal"
                value={options.cargo_kg === 0 ? "" : String(options.cargo_kg)}
                placeholder="0"
                onChange={(event) => {
                  const value = Number(event.target.value.replace(",", "."));
                  set("cargo_kg", Number.isFinite(value) ? Math.min(Math.max(value, 0), 2000) : 0);
                }}
                className="min-h-11 rounded-xl border border-input bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Temperatura (°C)
              <input
                inputMode="decimal"
                value={options.outside_temp_c === null ? "" : String(options.outside_temp_c)}
                placeholder="Opcional"
                onChange={(event) => {
                  const text = event.target.value.trim();
                  const value = Number(text.replace(",", "."));
                  set(
                    "outside_temp_c",
                    text === "" || !Number.isFinite(value)
                      ? null
                      : Math.min(Math.max(value, -40), 60),
                  );
                }}
                className="min-h-11 rounded-xl border border-input bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" id="style-label">
              Estilo de manejo
            </span>
            <div role="group" aria-labelledby="style-label" className="grid grid-cols-3 gap-2">
              {STYLES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={options.style === value}
                  onClick={() => set("style", value)}
                  className={pill(options.style === value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" id="ac-label">
              Aire acondicionado
            </span>
            <div role="group" aria-labelledby="ac-label" className="grid grid-cols-2 gap-2">
              {[true, false].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  aria-pressed={options.air_conditioning === on}
                  onClick={() => set("air_conditioning", on)}
                  className={pill(options.air_conditioning === on)}
                >
                  {on ? "Encendido" : "Apagado"}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <button
          type="button"
          onClick={save}
          disabled={saving || !estimate}
          className="min-h-13 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar trayecto"}
        </button>
        <p
          aria-live="polite"
          className={`min-h-5 text-sm ${status?.kind === "error" ? "text-destructive" : "text-primary"}`}
        >
          {status?.text ?? ""}
        </p>
      </section>
    </div>
  );
}
