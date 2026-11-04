import "server-only";
import { homeChargerPower } from "@elacharger/calc";
import type {
  Charger,
  ChargerModel,
  ChargerPower,
  ConnectorCode,
  CreateCharger,
  UpdateCharger,
} from "@elacharger/schemas";
import { type Db, unwrap } from "../db";
import { notFound } from "../http";
import { CHARGER_MODEL_SELECT, connectorId, getChargerModel, toChargerModel } from "./catalog";

const CHARGER_SELECT = `
  id, name, use, voltage_v, phases, circuit_amperage_a, efficiency, created_at,
  connector:connector_types(code),
  charger_model:charger_models(${CHARGER_MODEL_SELECT})
`;

interface ChargerRow {
  id: string;
  name: string;
  use: Charger["use"];
  voltage_v: number;
  phases: number;
  circuit_amperage_a: number;
  efficiency: number | null;
  created_at: string;
  connector: { code: string } | null;
  charger_model: Parameters<typeof toChargerModel>[0] | null;
}

export function chargerPower(
  setup: { voltage_v: number; phases: 1 | 3; circuit_amperage_a: number },
  model: ChargerModel | null,
): ChargerPower {
  const power = homeChargerPower({
    voltageV: setup.voltage_v,
    currentA: setup.circuit_amperage_a,
    phases: setup.phases,
    ratedKw: model?.rated_kw,
    maxAmperageA: model?.max_amperage_a,
  });
  return {
    kw: power.kw,
    limited_by: power.limitedBy === "charger" ? "charger" : "circuit",
    warnings: power.warnings,
  };
}

function toCharger(row: ChargerRow): Charger {
  const model = row.charger_model ? toChargerModel(row.charger_model) : null;
  const phases = row.phases === 3 ? 3 : 1;
  return {
    id: row.id,
    name: row.name,
    use: row.use,
    charger_model: model,
    voltage_v: row.voltage_v,
    phases,
    circuit_amperage_a: row.circuit_amperage_a,
    // The setup's connector, else the charger's own.
    connector: (row.connector?.code ?? model?.connector ?? null) as ConnectorCode | null,
    efficiency: row.efficiency,
    power: chargerPower(
      { voltage_v: row.voltage_v, phases, circuit_amperage_a: row.circuit_amperage_a },
      model,
    ),
    created_at: row.created_at,
  };
}

export async function listChargers(db: Db): Promise<Charger[]> {
  const rows = unwrap(
    await db.from("chargers").select(CHARGER_SELECT).order("created_at"),
    "Chargers",
  );
  return (rows as unknown as ChargerRow[]).map(toCharger);
}

export async function getCharger(db: Db, id: string): Promise<Charger> {
  const row = unwrap(
    await db.from("chargers").select(CHARGER_SELECT).eq("id", id).maybeSingle(),
    "Charger",
  );
  return toCharger(row as unknown as ChargerRow);
}

export async function createCharger(
  db: Db,
  userId: string,
  input: CreateCharger,
): Promise<Charger> {
  // Checks the model is visible to the caller before linking it.
  if (input.charger_model_id) await getChargerModel(db, input.charger_model_id);
  const created = unwrap(
    await db
      .from("chargers")
      .insert({
        owner_id: userId,
        name: input.name,
        use: "home",
        charger_model_id: input.charger_model_id,
        voltage_v: input.voltage_v,
        phases: input.phases,
        circuit_amperage_a: input.circuit_amperage_a,
        connector_type_id: await connectorId(db, input.connector),
        efficiency: input.efficiency,
      })
      .select("id")
      .single(),
    "Charger",
  );
  return getCharger(db, created.id);
}

export async function updateCharger(db: Db, id: string, input: UpdateCharger): Promise<Charger> {
  const { connector, ...rest } = input;
  if (rest.charger_model_id) await getChargerModel(db, rest.charger_model_id);
  const changes = {
    ...rest,
    ...(connector !== undefined ? { connector_type_id: await connectorId(db, connector) } : {}),
  };
  if (Object.keys(changes).length > 0) {
    const updated = unwrap(
      await db.from("chargers").update(changes).eq("id", id).select("id"),
      "Charger",
    );
    if (updated.length === 0) throw notFound("The charger does not exist.");
  }
  return getCharger(db, id);
}

export async function deleteCharger(db: Db, id: string): Promise<void> {
  const deleted = unwrap(await db.from("chargers").delete().eq("id", id).select("id"), "Charger");
  if (deleted.length === 0) throw notFound("The charger does not exist.");
}
