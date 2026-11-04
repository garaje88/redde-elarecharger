// Usage: pnpm catalog:import [open-ev-data|epa|ocm ...]   (default: all, in that order)
// Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
import type { Database } from "@elacharger/types";
import { createClient } from "@supabase/supabase-js";
import { type SyncSummary, importEpa, importOcm, importVariants } from "./runner";
import { EPA_CSV_URL, parseEpaCsv } from "./sources/epa";
import { OCM_REFERENCE_URL } from "./sources/ocm";
import { OPEN_EV_DATA_URL, parseOpenEvData } from "./sources/open-ev-data";

const SOURCES = ["open-ev-data", "epa", "ocm"] as const;
type Source = (typeof SOURCES)[number];

async function download(url: string): Promise<Response> {
  const response = await fetch(url, { headers: { "User-Agent": "Elacharger catalog importer" } });
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
  return response;
}

async function run(
  source: Source,
  client: ReturnType<typeof createClient<Database>>,
): Promise<SyncSummary> {
  const retrievedAt = new Date().toISOString().slice(0, 10);
  switch (source) {
    case "open-ev-data": {
      const { records, skipped } = parseOpenEvData(
        await (await download(OPEN_EV_DATA_URL)).json(),
        retrievedAt,
      );
      return importVariants(client, source, records, skipped);
    }
    case "epa": {
      // The CSV is Latin-1; names are ASCII, so decoding as such is lossless for what we use.
      const text = new TextDecoder("latin1").decode(
        await (await download(EPA_CSV_URL)).arrayBuffer(),
      );
      const { records, skipped } = parseEpaCsv(text);
      return importEpa(client, records, skipped, retrievedAt);
    }
    case "ocm":
      return importOcm(client, await (await download(OCM_REFERENCE_URL)).json());
  }
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

  const requested = process.argv.slice(2);
  const unknown = requested.filter((name) => !SOURCES.includes(name as Source));
  if (unknown.length > 0)
    throw new Error(`Unknown source(s): ${unknown.join(", ")}. Use ${SOURCES.join(", ")}.`);
  const sources = requested.length > 0 ? (requested as Source[]) : [...SOURCES];

  const client = createClient<Database>(url, key, { auth: { persistSession: false } });
  for (const source of sources) {
    const summary = await run(source, client);
    console.log(
      `${source}: ${summary.inserted} inserted, ${summary.updated} updated, ` +
        `${summary.skippedVerified} manual fields kept, ${summary.errors.length} skipped`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
