"use client";

import type { SessionStats } from "@elacharger/schemas";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { monthShort } from "./format";

/** kWh charged per month; the selected month is highlighted. */
export default function MonthlyChart({
  monthly,
  current,
}: {
  monthly: SessionStats["monthly"];
  current: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={170}>
      <BarChart data={monthly} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tickFormatter={monthShort}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          stroke="var(--border)"
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          stroke="var(--border)"
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          formatter={(value) => [`${formatNumber(Number(value), 1)} kWh`, "Cargados"]}
          labelFormatter={(month) => monthShort(String(month))}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            fontSize: 13,
          }}
        />
        <Bar
          dataKey="energy_kwh"
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
          shape={(props: {
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            payload?: { month: string };
          }) => (
            <rect
              x={props.x}
              y={props.y}
              width={props.width}
              height={props.height}
              rx={6}
              fill={props.payload?.month === current ? "var(--primary)" : "var(--brand-soft)"}
            />
          )}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
