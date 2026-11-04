"use client";

import type { ChargeEstimate } from "@elacharger/schemas";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { durationLabel } from "@/features/charge/explain";
import { formatKw } from "@/lib/format";

const hoursTick = (minute: number) =>
  minute >= 120
    ? `${Math.round(minute / 60)} h`
    : minute >= 60
      ? `${Math.round((minute / 60) * 10) / 10} h`
      : `${Math.round(minute)} min`;

/** Battery % against time; colors come from the theme tokens. */
export default function ChargeChart({ curve }: { curve: ChargeEstimate["curve"] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={curve} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="charge-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="minute"
          type="number"
          domain={[0, "dataMax"]}
          tickFormatter={hoursTick}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          stroke="var(--border)"
        />
        <YAxis
          dataKey="soc"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v: number) => `${v} %`}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          stroke="var(--border)"
        />
        <Tooltip
          formatter={(value, name, item) =>
            name === "soc"
              ? [`${String(value)} % · ${formatKw((item.payload as { kw: number }).kw)}`, "Batería"]
              : [String(value), String(name)]
          }
          labelFormatter={(minute) => durationLabel(Number(minute))}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 13,
          }}
        />
        <Area
          type="monotone"
          dataKey="soc"
          stroke="var(--primary)"
          strokeWidth={2.5}
          fill="url(#charge-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
