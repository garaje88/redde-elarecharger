"use client";

import type { Place } from "@elacharger/schemas";
import { Clock, MapPin } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { useDebounced } from "@/lib/use-debounced";

// The last places the user picked, on this device only, offered before they type.
const RECENT_KEY = "elacharger:recent-places";
const RECENT_MAX = 5;

function readRecent(): Place[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Place[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function rememberPlace(place: Place) {
  try {
    const others = readRecent().filter((p) => p.label !== place.label);
    localStorage.setItem(RECENT_KEY, JSON.stringify([place, ...others].slice(0, RECENT_MAX)));
  } catch {
    // Storage may be unavailable (private mode); recents are only a convenience.
  }
}

/** "Girardot, CU, Colombia" → name "Girardot", detail "CU, Colombia". */
function splitLabel(label: string) {
  const comma = label.indexOf(",");
  return comma < 0
    ? { name: label, detail: "" }
    : { name: label.slice(0, comma), detail: label.slice(comma + 1).trim() };
}

/** Address search with suggestions (ARIA combobox); 400 ms debounce per docs/PLAN.md. */
export function PlaceSearch({
  label,
  marker,
  value,
  focus,
  active,
  onFocus,
  onSelect,
}: {
  label: string;
  marker: "A" | "B";
  value: Place | null;
  focus?: { lat: number; lng: number } | null;
  active: boolean;
  onFocus: () => void;
  onSelect: (place: Place) => void;
}) {
  const listId = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [editing, setEditing] = useState(false);
  const query = useDebounced(text.trim(), 400);
  // Results with the query they answer: until it matches the current query, it is loading.
  const [answer, setAnswer] = useState<{ query: string; items: Place[]; ok: boolean } | null>(null);
  const [recent, setRecent] = useState<Place[]>([]);
  const [highlight, setHighlight] = useState(0);

  // Show the chosen place's name when it changes from outside (map tap, swap).
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value?.label ?? "");
    setEditing(false);
  }

  useEffect(() => {
    if (!editing || query.length < 2) return;
    let current = true;
    void api
      .GET("/routing/geocode", {
        params: { query: { q: query, ...(focus ? { lat: focus.lat, lng: focus.lng } : {}) } },
      })
      .then(({ data }) => {
        if (current) {
          setAnswer({ query, items: data?.items ?? [], ok: data !== undefined });
          setHighlight(0);
        }
      });
    return () => {
      current = false;
    };
  }, [query, editing, focus]);

  const searching = editing && query.length >= 2;
  // The geocoder can return the same place twice (city and locality): keep the first.
  const results = (answer?.items ?? []).filter(
    (place, index, all) => all.findIndex((p) => p.label === place.label) === index,
  );
  const loading = searching && answer?.query !== query;
  // Before typing, the recent places stand in for the suggestions.
  const options = searching ? results : editing && text.trim() === "" ? recent : [];
  const open = options.length > 0;
  const note = !searching
    ? null
    : loading && results.length === 0
      ? "Buscando…"
      : !loading && answer?.ok === false
        ? "La búsqueda de lugares no está disponible ahora."
        : !loading && results.length === 0
          ? "Sin resultados. Prueba con otro nombre o toca el mapa."
          : null;
  const choose = (place: Place) => {
    setEditing(false);
    setAnswer(null);
    rememberPlace(place);
    onSelect(place);
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            marker === "A"
              ? "bg-inverse text-inverse-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {marker}
        </span>
        <span className="sr-only">{label}</span>
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${highlight}` : undefined}
          value={text}
          placeholder={label}
          onFocus={() => {
            setRecent(readRecent());
            if (text.trim() === "") setEditing(true);
            onFocus();
          }}
          onChange={(event) => {
            setText(event.target.value);
            setEditing(true);
          }}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === "ArrowDown") setHighlight((h) => Math.min(h + 1, options.length - 1));
            else if (event.key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
            else if (event.key === "Enter" && options[highlight]) choose(options[highlight]);
            else if (event.key === "Escape") setEditing(false);
            else return;
            event.preventDefault();
          }}
          className={`min-h-11 w-full rounded-xl border bg-card px-3 text-[15px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
            active ? "border-foreground/50" : "border-input"
          }`}
        />
      </label>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={searching ? `Sugerencias para ${label}` : `Lugares recientes para ${label}`}
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {options.map((place, index) => {
            const { name, detail } = splitLabel(place.label);
            const Icon = searching ? MapPin : Clock;
            return (
              <li
                key={`${place.lat},${place.lng},${place.label}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                aria-label={place.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${index === highlight ? "bg-muted" : ""}`}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{name}</span>
                  {detail && (
                    <span className="truncate text-xs text-muted-foreground">{detail}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {note && !open && (
        <p
          role="status"
          className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground shadow-lg"
        >
          {note}
        </p>
      )}
    </div>
  );
}
