"use client";

import dynamic from "next/dynamic";

/** Recharts loads only in the browser; the server renders a placeholder of the same size. */
export const MonthlyChartLazy = dynamic(() => import("./monthly-chart"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[170px] animate-pulse rounded-xl bg-muted" />,
});
