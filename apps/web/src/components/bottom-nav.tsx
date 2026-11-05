"use client";

import { BarChart3, Car, House, Route, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Inicio", icon: House, ready: true },
  { href: "/trip", label: "Trayecto", icon: Route, ready: true },
  { href: "/charge", label: "Carga", icon: Zap, ready: true },
  { href: "/garage", label: "Garaje", icon: Car, ready: true },
  { href: "/sessions", label: "Recargas", icon: BarChart3, ready: true },
] as const;

/** Mobile tab bar; becomes a side rail from md up. */
export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

/** Same bar without an active item, shown while the URL is not known yet (prerender). */
export function BottomNavFallback() {
  return <NavBar pathname={null} />;
}

function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:w-24 md:border-t-0 md:border-r md:pt-6"
    >
      <ul className="mx-auto flex max-w-md items-start justify-around px-1 pt-2 md:h-full md:flex-col md:justify-start md:gap-2">
        {ITEMS.map(({ href, label, icon: Icon, ready }) => {
          const active =
            pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          const content = (
            <>
              <Icon aria-hidden="true" className="size-6" strokeWidth={1.75} />
              {label}
            </>
          );
          const base =
            "flex min-h-11 min-w-16 flex-col items-center gap-1 rounded-xl px-1 pb-2 text-[11px] md:w-full";
          return (
            <li key={href} className="md:w-full">
              {ready ? (
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`${base} focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                    active
                      ? "font-semibold text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {content}
                </Link>
              ) : (
                <span className={`${base} text-muted-foreground/50`} aria-disabled="true">
                  {content}
                  <span className="sr-only">(próximamente)</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
