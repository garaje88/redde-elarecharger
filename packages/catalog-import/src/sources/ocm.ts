// Open Charge Map reference data. The live API needs a key; OCM publishes the same reference data
// in its official export repository, which needs none.
import type { ConnectorCode } from "../types";

export const OCM_REFERENCE_URL =
  "https://raw.githubusercontent.com/openchargemap/ocm-export/main/data/referencedata.json";

interface OcmConnectionType {
  ID: number;
  Title: string;
  FormalName?: string | null;
  IsDiscontinued?: boolean | null;
  IsObsolete?: boolean | null;
}

/** OCM ConnectionType id expected for each of our codes, checked against its title. */
const EXPECTED: Record<ConnectorCode, { id: number; title: RegExp }> = {
  TYPE1: { id: 1, title: /J1772/i },
  TYPE2: { id: 25, title: /^Type 2/i },
  GBT_AC: { id: 1038, title: /GB-?T AC/i },
  CCS1: { id: 32, title: /CCS \(Type 1\)/i },
  CCS2: { id: 33, title: /CCS \(Type 2\)/i },
  CHADEMO: { id: 2, title: /CHAdeMO/i },
  GBT_DC: { id: 1040, title: /GB-?T DC/i },
  NACS: { id: 27, title: /NACS/i },
};

export interface OcmMatch {
  ids: Partial<Record<ConnectorCode, number>>;
  missing: ConnectorCode[];
}

/** Maps our connector codes to OCM ids, only when OCM still lists that id with a matching title. */
export function matchOcmConnectors(referenceData: unknown): OcmMatch {
  const types = (referenceData as { ConnectionTypes?: unknown } | null)?.ConnectionTypes;
  if (!Array.isArray(types)) throw new Error("OCM: expected a `ConnectionTypes` array.");

  const byId = new Map((types as OcmConnectionType[]).map((type) => [type.ID, type]));
  const ids: OcmMatch["ids"] = {};
  const missing: ConnectorCode[] = [];

  for (const [code, expected] of Object.entries(EXPECTED) as [
    ConnectorCode,
    (typeof EXPECTED)[ConnectorCode],
  ][]) {
    const type = byId.get(expected.id);
    if (type && expected.title.test(type.Title) && type.IsObsolete !== true) ids[code] = type.ID;
    else missing.push(code);
  }
  return { ids, missing };
}
