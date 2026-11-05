import type { Metadata } from "next";
import { ImportFlow } from "./import-flow";

export const metadata: Metadata = { title: "Importar ficha técnica" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6">
      <ImportFlow />
    </main>
  );
}
