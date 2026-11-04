/** Battery ring: the arrival charge solid, what the trip uses lighter (salida → llegada). */
export function BatteryRing({
  start,
  arrival,
  tone,
}: {
  start: number;
  arrival: number;
  tone: "ok" | "tight" | "short";
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const color =
    tone === "ok" ? "var(--primary)" : tone === "tight" ? "var(--warning)" : "var(--destructive)";
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="8" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity="0.3"
        strokeWidth="8"
        strokeDasharray={`${(clamp(start) / 100) * c} ${c}`}
      />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(clamp(arrival) / 100) * c} ${c}`}
      />
    </svg>
  );
}
