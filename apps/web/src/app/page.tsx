import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-primary">Elacharger</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          Calcula tu trayecto y tu carga en segundos
        </h1>
        <p className="text-muted-foreground">
          Estima cuánta batería consumes del punto A al punto B y cuánto tarda en cargar tu carro
          eléctrico hasta el porcentaje que necesitas.
        </p>
      </div>
      <Button size="lg" disabled className="min-h-11">
        Próximamente
      </Button>
    </main>
  );
}
