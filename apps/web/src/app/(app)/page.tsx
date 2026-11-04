import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/session";
import { signOut } from "./actions";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <p className="text-muted-foreground">
        Pronto podrás planear trayectos y calcular el tiempo de carga de tu carro eléctrico.
        Mientras tanto, arma tu{" "}
        <Link
          href="/garage"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          garaje
        </Link>
        .
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="lg" className="min-h-11">
          Cerrar sesión
        </Button>
      </form>
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

function GreetingSkeleton() {
  return <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded-lg bg-muted" />;
}
