import type { Metadata } from "next";
import { VehicleWizard } from "./vehicle-wizard";

export const metadata: Metadata = { title: "Agregar vehículo" };

export default function NewVehiclePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6">
      <VehicleWizard />
    </main>
  );
}
