"use client";

import type { Place } from "@elacharger/schemas";
import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { useDebounced } from "@/lib/use-debounced";

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
  const [results, setResults] = useState<Place[]>([]);
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
          setResults(data?.items ?? []);
          setHighlight(0);
        }
      });
    return () => {
      current = false;
    };
  }, [query, editing, focus]);

  const open = editing && query.length >= 2 && results.length > 0;
  const choose = (place: Place) => {
    setEditing(false);
    setResults([]);
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
          onFocus={onFocus}
          onChange={(event) => {
            setText(event.target.value);
            setEditing(true);
          }}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === "ArrowDown") setHighlight((h) => Math.min(h + 1, results.length - 1));
            else if (event.key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
            else if (event.key === "Enter" && results[highlight]) choose(results[highlight]);
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
          aria-label={`Sugerencias para ${label}`}
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          {results.map((place, index) => (
            <li
              key={`${place.lat},${place.lng},${place.label}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
              className={`cursor-pointer px-3 py-2.5 text-sm ${index === highlight ? "bg-muted" : ""}`}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
