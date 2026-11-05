import {
  BarChart3,
  Car,
  ChevronRight,
  History,
  Route,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/server/session";

const SHORTCUTS = [
  {
    href: "/trip",
    label: "Planear un trayecto",
    hint: "Cuánta batería gastas de A a B",
    icon: Route,
  },
  { href: "/charge", label: "Calcular una carga", hint: "Cuánto tarda y cuánto cuesta", icon: Zap },
  {
    href: "/sessions/new",
    label: "Registrar una recarga",
    hint: "Tu consumo real",
    icon: BarChart3,
  },
  {
    href: "/assistant",
    label: "Preguntarle al asistente",
    hint: "«¿Llego a Medellín con 70 %?»",
    icon: Sparkles,
  },
  { href: "/history", label: "Historial", hint: "Repite un cálculo guardado", icon: History },
  { href: "/garage", label: "Garaje", hint: "Tus carros y cargadores", icon: Car },
  { href: "/settings", label: "Ajustes", hint: "Tarifa, privacidad y tu cuenta", icon: Settings },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Greeting />
      <nav aria-label="Accesos rápidos">
        <ul className="flex flex-col gap-2">
          {SHORTCUTS.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-16 items-center gap-4 rounded-[20px] bg-card px-4 py-3 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{label}</span>
                  <span className="text-[13px] text-muted-foreground">{hint}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <Link
        href="/acerca"
        className="text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Acerca de y fuentes de datos
      </Link>
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  const firstName = user.name?.split(" ")[0];
  return (
    <h1 className="font-heading text-2xl font-semibold">
      {firstName ? `Hola, ${firstName}` : "Hola"}
    </h1>
  );
}
