"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { THEME_COLORS, THEME_COOKIE, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
];

/** Applies the theme at once and remembers it for a year on this device. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  const maxAge = theme === "system" ? 0 : 60 * 60 * 24 * 365;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${maxAge}; samesite=lax; secure`;
  // The browser bar follows the page until the next full load re-renders the meta tags.
  if (theme !== "system") {
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = THEME_COLORS[theme];
    }
  }
}

export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Tema</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring ${
              theme === value
                ? "bg-card font-semibold shadow-sm"
                : "font-medium text-muted-foreground"
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => {
                setTheme(value);
                applyTheme(value);
              }}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
            {label}
          </label>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground">
        {theme === "system"
          ? "Sigue el modo claro u oscuro de tu dispositivo."
          : "Se guarda en este dispositivo."}
      </p>
    </fieldset>
  );
}
