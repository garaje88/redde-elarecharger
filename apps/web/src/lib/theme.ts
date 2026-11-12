// Appearance chosen in Ajustes. "system" follows the device; the choice lives in a cookie so the
// server renders the right theme on the first paint (no inline script, which the CSP forbids).

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";

export const parseTheme = (value: string | undefined): Theme =>
  THEMES.includes(value as Theme) ? (value as Theme) : "system";

/** Browser bar colour per theme, matching --background. */
export const THEME_COLORS = { light: "#f5f6f1", dark: "#0e1116" } as const;
