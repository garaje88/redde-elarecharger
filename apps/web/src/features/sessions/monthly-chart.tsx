import type { SessionStats } from "@elacharger/schemas";
import { formatNumber } from "@/lib/format";
import { monthShort } from "./format";

// Plain SVG (no chart library): it renders on the server and costs no JavaScript.
const W = 340;
const H = 170;
const PAD = { top: 18, right: 4, bottom: 22, left: 4 };
const PLOT_H = H - PAD.top - PAD.bottom;

/** kWh charged per month; the selected month is highlighted. */
export function MonthlyChart({
  monthly,
  current,
}: {
  monthly: SessionStats["monthly"];
  current: string;
}) {
  if (monthly.length === 0) return null;
  const max = Math.max(1, ...monthly.map((m) => m.energy_kwh));
  const slot = (W - PAD.left - PAD.right) / monthly.length;
  const barW = Math.min(36, slot * 0.6);

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
          stroke="var(--border)"
        />
        {monthly.map((m, i) => {
          const h = (m.energy_kwh / max) * PLOT_H;
          const cx = PAD.left + slot * i + slot / 2;
          const top = H - PAD.bottom - h;
          return (
            <g key={m.month}>
              {h > 0 && (
                <rect
                  x={cx - barW / 2}
                  y={top}
                  width={barW}
                  height={h}
                  rx={6}
                  fill={m.month === current ? "var(--primary)" : "var(--brand-soft)"}
                />
              )}
              {m.energy_kwh > 0 && (
                <text
                  x={cx}
                  y={top - 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--muted-foreground)"
                >
                  {formatNumber(m.energy_kwh, 0)}
                </text>
              )}
              <text
                x={cx}
                y={H - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={m.month === current ? 600 : 400}
                fill={m.month === current ? "var(--foreground)" : "var(--muted-foreground)"}
              >
                {monthShort(m.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">kWh cargados por mes</figcaption>
    </figure>
  );
}
