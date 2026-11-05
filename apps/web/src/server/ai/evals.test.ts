import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { AiUploadContentType } from "@elacharger/schemas";
import { describe, expect, it } from "vitest";
import { DEFAULT_MODELS } from "./client";
import { AnthropicExtractor, type RawExtraction, toReceiptDraft, toVehicleDraft } from "./extract";

// AI evals (docs/PLAN.md, Funcionalidades de IA): 10 technical sheets and 10 charging photos
// with known values. CI replays the recorded model answers through the same validation the app
// uses; RECORD_AI_EVALS=1 (with ANTHROPIC_API_KEY) asks the real API again and re-records.
//   RECORD_AI_EVALS=1 ANTHROPIC_API_KEY=… pnpm --filter @elacharger/web exec vitest run evals

const dir = join(import.meta.dirname, "../../../test/ai-evals");
const expected = JSON.parse(readFileSync(join(dir, "expected.json"), "utf8")) as {
  sheets: Record<string, Record<string, unknown> | null>;
  photos: Record<string, Record<string, unknown> | null>;
};
const RECORD = process.env.RECORD_AI_EVALS === "1";
// The day the fixtures were recorded: photos without a year are read against it.
const TODAY = "2026-11-05";

const MEDIA: Record<string, AiUploadContentType> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
};

const recordedPath = (file: string) => join(dir, "recorded", `${file}.json`);

async function answer(kind: "sheets" | "photos", file: string): Promise<RawExtraction> {
  if (RECORD) {
    const extractor = new AnthropicExtractor(
      new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 }),
      process.env.AI_MODEL_EXTRACTION ?? DEFAULT_MODELS.extraction,
    );
    const bytes = new Uint8Array(readFileSync(join(dir, kind, file)));
    const result = await extractor.extract(
      kind === "sheets" ? "vehicle_spec" : "charging_receipt",
      { bytes, mediaType: MEDIA[file.split(".").pop()!]! },
      TODAY,
    );
    writeFileSync(recordedPath(file), `${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
  if (!existsSync(recordedPath(file))) throw new Error(`No recorded answer for ${file}`);
  return JSON.parse(readFileSync(recordedPath(file), "utf8")) as RawExtraction;
}

/** Numbers within 1 %, names by containment, everything else exactly; "*" is not scored. */
function matches(key: string, want: unknown, got: unknown): boolean {
  if (want === null || got === null || got === undefined) return want === null && got == null;
  if (typeof want === "number")
    return typeof got === "number" && Math.abs(got - want) <= Math.abs(want) * 0.01;
  if (["brand", "model", "location_label", "chemistry"].includes(key)) {
    return String(got).toLowerCase().includes(String(want).toLowerCase());
  }
  return got === want;
}

interface Score {
  correct: number;
  total: number;
  misses: string[];
}

function score(
  file: string,
  want: Record<string, unknown> | null,
  got: Record<string, unknown> | null,
  into: Score,
) {
  if (want === null) {
    into.total += 1;
    if (got === null) into.correct += 1;
    else into.misses.push(`${file}: should be rejected`);
    return;
  }
  for (const [key, value] of Object.entries(want)) {
    if (value === "*") continue;
    into.total += 1;
    if (matches(key, value, got?.[key] ?? null)) into.correct += 1;
    else
      into.misses.push(
        `${file}.${key}: want ${JSON.stringify(value)}, got ${JSON.stringify(got?.[key] ?? null)}`,
      );
  }
}

describe("AI evals (recorded answers)", { timeout: RECORD ? 600_000 : 10_000 }, () => {
  it("IA1 reads ≥ 90 % of the technical sheet fields right", async () => {
    const result: Score = { correct: 0, total: 0, misses: [] };
    for (const [file, want] of Object.entries(expected.sheets)) {
      const { raw } = await answer("sheets", file);
      score(file, want, toVehicleDraft(raw)?.spec ?? null, result);
    }
    const accuracy = result.correct / result.total;
    console.info(
      `IA1 sheets: ${(accuracy * 100).toFixed(1)} % (${result.correct}/${result.total})`,
      result.misses,
    );
    expect(result.total).toBeGreaterThan(100);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it("IA2 reads ≥ 90 % of the charging photo fields right", async () => {
    const result: Score = { correct: 0, total: 0, misses: [] };
    for (const [file, want] of Object.entries(expected.photos)) {
      const { raw } = await answer("photos", file);
      score(file, want, toReceiptDraft(raw)?.draft ?? null, result);
    }
    const accuracy = result.correct / result.total;
    console.info(
      `IA2 photos: ${(accuracy * 100).toFixed(1)} % (${result.correct}/${result.total})`,
      result.misses,
    );
    expect(result.total).toBeGreaterThan(60);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });
});
