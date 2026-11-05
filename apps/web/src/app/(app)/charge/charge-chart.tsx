import type { ChargeEstimate } from "@elacharger/schemas";
import { durationLabel } from "@/features/charge/explain";
import { formatKw } from "@/lib/format";

// Plain SVG (no chart library): it renders on the server and costs no JavaScript.
const W = 340;
const H = 180;
const PAD = { top: 8, right: 8, bottom: 22, left: 38 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const SOC_TICKS = [0, 25, 50, 75, 100];

const hoursTick = (minute: number) =>
  minute >= 120
    ? `${Math.round(minute / 60)} h`
    : minute >= 60
      ? `${Math.round((minute / 60) * 10) / 10} h`
      : `${Math.round(minute)} min`;

/** Battery % against time; colors come from the theme tokens. */
export default function ChargeChart({ curve }: { curve: ChargeEstimate["curve"] }) {
  const last = curve.at(-1);
  if (!last || last.minute <= 0) return null;
  const x = (minute: number) => PAD.left + (minute / last.minute) * PLOT_W;
  const y = (soc: number) => PAD.top + (1 - soc / 100) * PLOT_H;
  const line = curve.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.minute)},${y(p.soc)}`).join(" ");
  const area = `${line} L${x(last.minute)},${y(0)} L${x(0)},${y(0)} Z`;
  const timeTicks = [0, 1, 2, 3].map((i) => (last.minute * i) / 3);
  const first = curve[0];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Batería de ${first?.soc ?? 0} % a ${last.soc} % en ${durationLabel(last.minute)}; al final carga a ${formatKw(last.kw)}.`}
    >
      <defs>
        <linearGradient id="charge-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {SOC_TICKS.map((soc) => (
        <g key={soc}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(soc)} y2={y(soc)} stroke="var(--border)" />
          <text
            x={PAD.left - 6}
            y={y(soc) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {soc} %
          </text>
        </g>
      ))}
      {timeTicks.map((minute, i) => (
        <text
          key={minute}
          x={x(minute)}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === timeTicks.length - 1 ? "end" : "middle"}
          fontSize={11}
          fill="var(--muted-foreground)"
        >
          {hoursTick(minute)}
        </text>
      ))}
      <path d={area} fill="url(#charge-fill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
