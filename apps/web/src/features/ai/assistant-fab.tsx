"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Only on overview screens: on forms and the map it would cover their own bottom actions. The home
// dashboard has its own "Preguntar a la IA" button.
const SHOWN_ON = ["/garage", "/sessions", "/history"];

/** Floating button to the assistant (IA3). */
export function AssistantFab() {
  const pathname = usePathname();
  if (!SHOWN_ON.includes(pathname)) return null;
  return (
    <Link
      href="/assistant"
      aria-label="Abrir el asistente"
      className="fixed right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-inverse shadow-lg hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:right-6 md:bottom-6 dark:border dark:border-border"
    >
      <Sparkles aria-hidden="true" className="size-6 text-brand-bright" strokeWidth={1.75} />
    </Link>
  );
}
