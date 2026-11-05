import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  AI_UPLOAD_LIMITS,
  type AiExtraction,
  type AiUpload,
  type AiUploadRequest,
  type AiUsageSummary,
  type AssistantCard,
  type AssistantEvent,
  type AssistantRequest,
  type AssistantTurn,
  type Conversation,
  type ConversationSummary,
  type CreateExtraction,
  ReceiptDraftSchema,
  type Submission,
} from "@elacharger/schemas";
import type { Json } from "@elacharger/types";
import { getServerEnv } from "@/env";
import { runAssistant } from "../ai/assistant";
import {
  EXTRACTION_FEATURES,
  aiModel,
  getAnthropic,
  recordUsage,
  requireAi,
  underMonthlyBudget,
  usageToday,
} from "../ai/client";
import {
  AnthropicExtractor,
  type Extractor,
  sniffMediaType,
  toReceiptDraft,
  toVehicleDraft,
} from "../ai/extract";
import { type Db, unwrap } from "../db";
import { ApiError, notFound } from "../http";
import { getSubmission } from "./lookup";
import { getProfile } from "./profile";

export const AI_BUCKET = "ai-uploads";

const EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const UPLOAD_PATH = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

const extractionLimit = () => ({
  features: EXTRACTION_FEATURES,
  max: getServerEnv().AI_DAILY_LIMIT_EXTRACTIONS,
  noun: "AI extractions",
});

/** Colombian calendar day (UTC-5), for dates printed without a year. */
const colombiaToday = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

// Uploads -------------------------------------------------------------------------------

/**
 * A signed URL to upload one file straight to the private bucket (the phone uploads from the
 * camera without going through this server). Checked against the limits first, so nobody
 * uploads a file that cannot be read.
 */
export async function createUpload(
  db: Db,
  userId: string,
  input: AiUploadRequest,
): Promise<AiUpload> {
  await requireAi(db, extractionLimit());
  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[input.content_type]}`;
  const { data, error } = await db.storage.from(AI_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Signed upload: ${error?.message ?? "no data"}`);
  return { path: data.path, signed_url: data.signedUrl, token: data.token };
}

async function removeUpload(db: Db, path: string) {
  const { error } = await db.storage.from(AI_BUCKET).remove([path]);
  // The hourly purge (scripts/purge-ai-uploads.mjs) removes anything left behind.
  if (error) console.error("AI upload cleanup failed", { error: error.message });
}

// Extractions (IA1, IA2) --------------------------------------------------------------------

let extractorOverride: Extractor | undefined;

/** Test hook: replace the extractor (recorded answers). */
export function setExtractor(next: Extractor | undefined) {
  extractorOverride = next;
}

type ExtractionRow = {
  id: string;
  kind: AiExtraction["kind"];
  status: AiExtraction["status"];
  model: string;
  extracted: unknown;
  confidence: unknown;
  submission_id: string | null;
  created_at: string;
};

const EXTRACTION_SELECT =
  "id, kind, status, model, extracted, confidence, submission_id, created_at";

async function toExtraction(db: Db, row: ExtractionRow): Promise<AiExtraction> {
  const confidence = (row.confidence ?? {}) as Record<string, number>;
  const base = {
    id: row.id,
    status: row.status,
    model: row.model,
    confidence,
    created_at: row.created_at,
  };
  if (row.kind === "charging_receipt") {
    const draft = ReceiptDraftSchema.safeParse(row.extracted);
    return {
      ...base,
      kind: "charging_receipt",
      draft: draft.success
        ? draft.data
        : {
            energy_kwh: null,
            cost: null,
            currency: null,
            start_soc: null,
            end_soc: null,
            started_at: null,
            ended_at: null,
            odometer_km: null,
            location_label: null,
          },
    };
  }
  const submission: Submission | null = row.submission_id
    ? await getSubmission(db, row.submission_id)
    : null;
  return { ...base, kind: "vehicle_spec", submission };
}

/**
 * Reads an uploaded sheet (IA1) or charging photo (IA2) and stores the draft. Nothing reaches
 * the garage or the sessions until the user confirms it. The upload is deleted right after.
 */
export async function createExtraction(
  db: Db,
  userId: string,
  input: CreateExtraction,
): Promise<AiExtraction> {
  const match = UPLOAD_PATH.exec(input.path);
  if (!match || match[1] !== userId) throw notFound("The upload does not exist.");
  const anthropic = await requireAi(db, extractionLimit());

  const { data: blob, error } = await db.storage.from(AI_BUCKET).download(input.path);
  if (error || !blob) throw notFound("The upload does not exist.");
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mediaType = sniffMediaType(bytes);
    if (!mediaType || (input.kind === "charging_receipt" && mediaType === "application/pdf")) {
      throw new ApiError(422, "Unprocessable Content", {
        detail:
          input.kind === "charging_receipt"
            ? "Upload a JPEG, PNG or WebP photo."
            : "Upload a PDF or a JPEG, PNG or WebP photo.",
      });
    }
    if (bytes.byteLength > AI_UPLOAD_LIMITS[mediaType]) {
      throw new ApiError(422, "Unprocessable Content", {
        detail: "PDFs up to 10 MB and images up to 5 MB.",
      });
    }

    const extractor = extractorOverride ?? new AnthropicExtractor(anthropic, aiModel("extraction"));
    const { raw, model, usage } = await extractor.extract(
      input.kind,
      { bytes, mediaType },
      colombiaToday(),
    );
    await recordUsage(db, input.kind, model, usage);

    let extracted: NonNullable<Json> = {};
    let confidence: Record<string, number> = {};
    let submissionId: string | null = null;
    if (input.kind === "charging_receipt") {
      const receipt = toReceiptDraft(raw);
      if (receipt) {
        extracted = receipt.draft as unknown as NonNullable<Json>;
        confidence = receipt.confidence;
      }
    } else {
      const sheet = toVehicleDraft(raw);
      if (sheet) {
        extracted = sheet.spec as unknown as NonNullable<Json>;
        confidence = sheet.confidence;
        const spec = sheet.spec as { brand: string; model: string; trim: string };
        const submission = unwrap(
          await db
            .from("catalog_submissions")
            .insert({
              user_id: userId,
              kind: "vehicle",
              query: `${spec.brand} ${spec.model} ${spec.trim}`.trim().slice(0, 200),
              extracted: {
                spec: sheet.spec,
                confidence,
                field_urls: {},
              } as unknown as NonNullable<Json>,
              sources: [],
            })
            .select("id")
            .single(),
          "Submission",
        );
        submissionId = submission.id;
      }
    }

    const row = unwrap(
      await db
        .from("ai_extractions")
        .insert({
          user_id: userId,
          kind: input.kind,
          storage_path: input.path,
          extracted,
          confidence,
          model,
          submission_id: submissionId,
        })
        .select(EXTRACTION_SELECT)
        .single(),
      "Extraction",
    );
    return toExtraction(db, row as ExtractionRow);
  } finally {
    await removeUpload(db, input.path);
  }
}

export async function getExtraction(db: Db, id: string): Promise<AiExtraction> {
  const row = unwrap(
    await db.from("ai_extractions").select(EXTRACTION_SELECT).eq("id", id).maybeSingle(),
    "Extraction",
  );
  return toExtraction(db, row as ExtractionRow);
}

/** The user kept (confirmed) or threw away the draft. */
export async function updateExtraction(
  db: Db,
  id: string,
  status: "confirmed" | "discarded",
): Promise<AiExtraction> {
  const row = unwrap(
    await db
      .from("ai_extractions")
      .update({ status })
      .eq("id", id)
      .select(EXTRACTION_SELECT)
      .maybeSingle(),
    "Extraction",
  );
  return toExtraction(db, row as ExtractionRow);
}

// Usage -----------------------------------------------------------------------------------

export async function usageSummary(db: Db): Promise<AiUsageSummary> {
  const env = getServerEnv();
  const [extractions, messages, budgetLeft] = await Promise.all([
    usageToday(db, EXTRACTION_FEATURES),
    usageToday(db, ["assistant"]),
    getAnthropic() ? underMonthlyBudget(db) : Promise.resolve(false),
  ]);
  return {
    available: budgetLeft,
    extractions_today: extractions,
    extractions_limit: env.AI_DAILY_LIMIT_EXTRACTIONS,
    messages_today: messages,
    messages_limit: env.AI_DAILY_LIMIT_MESSAGES,
  };
}

// Assistant (IA3) --------------------------------------------------------------------------

const MAX_TRANSCRIPT_MESSAGES = 60;

type ConversationRow = {
  id: string;
  title: string;
  messages: unknown;
  cards: unknown;
  updated_at: string;
};

/**
 * Checks limits and loads the history before any byte is streamed, so those failures are
 * ordinary problem+json responses. Returns the turn to run inside the event stream.
 */
export async function prepareAssistantTurn(db: Db, userId: string, input: AssistantRequest) {
  const anthropic = await requireAi(db, {
    features: ["assistant"],
    max: getServerEnv().AI_DAILY_LIMIT_MESSAGES,
    noun: "assistant messages",
  });
  const profile = await getProfile(db, userId);

  let conversation: ConversationRow | null = null;
  let history: Anthropic.MessageParam[] = [];
  if (input.conversation_id) {
    conversation = unwrap(
      await db
        .from("ai_conversations")
        .select("id, title, messages, cards, updated_at")
        .eq("id", input.conversation_id)
        .maybeSingle(),
      "Conversation",
    ) as ConversationRow;
    history = conversation.messages as Anthropic.MessageParam[];
  } else if (input.history) {
    history = input.history as Anthropic.MessageParam[];
  }
  if (history.length >= MAX_TRANSCRIPT_MESSAGES) {
    throw new ApiError(422, "Unprocessable Content", {
      detail: "This conversation is too long. Start a new one.",
    });
  }

  return async (emit: (event: AssistantEvent) => void, signal?: AbortSignal) => {
    const model = aiModel("assistant");
    const run = await runAssistant({
      anthropic,
      model,
      ctx: { db, userId },
      history,
      message: input.message,
      emit,
      signal,
    });
    await recordUsage(db, "assistant", model, run.usage);

    if (!profile.store_ai_conversations) {
      emit({
        type: "done",
        conversation_id: null,
        history: run.messages as { role: "user" | "assistant"; content: unknown }[],
      });
      return;
    }
    const cards = {
      ...((conversation?.cards ?? {}) as Record<string, AssistantCard>),
      ...run.cards,
    };
    const saved = conversation
      ? unwrap(
          await db
            .from("ai_conversations")
            .update({
              messages: run.messages as unknown as NonNullable<Json>,
              cards: cards as unknown as NonNullable<Json>,
            })
            .eq("id", conversation.id)
            .select("id")
            .single(),
          "Conversation",
        )
      : unwrap(
          await db
            .from("ai_conversations")
            .insert({
              user_id: userId,
              title: input.message.slice(0, 120),
              messages: run.messages as unknown as NonNullable<Json>,
              cards: cards as unknown as NonNullable<Json>,
            })
            .select("id")
            .single(),
          "Conversation",
        );
    emit({ type: "done", conversation_id: saved.id, history: null });
  };
}

/** The stored transcript as the turns the app shows: text plus the cards of each answer. */
export function toTurns(
  messages: Anthropic.MessageParam[],
  cards: Record<string, AssistantCard>,
): AssistantTurn[] {
  const turns: AssistantTurn[] = [];
  for (const message of messages) {
    const blocks =
      typeof message.content === "string"
        ? [{ type: "text" as const, text: message.content }]
        : message.content;
    if (message.role === "user") {
      const text = blocks
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("\n");
      if (text) turns.push({ role: "user", text, cards: [] });
      continue;
    }
    let turn = turns.at(-1);
    if (!turn || turn.role !== "assistant") {
      turn = { role: "assistant", text: "", cards: [] };
      turns.push(turn);
    }
    for (const block of blocks) {
      if (block.type === "text") turn.text += block.text;
      if (block.type === "tool_use" && cards[block.id]) turn.cards.push(cards[block.id]!);
    }
  }
  return turns;
}

export async function listConversations(db: Db): Promise<ConversationSummary[]> {
  return unwrap(
    await db
      .from("ai_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
    "Conversations",
  );
}

export async function getConversation(db: Db, id: string): Promise<Conversation> {
  const row = unwrap(
    await db
      .from("ai_conversations")
      .select("id, title, messages, cards, updated_at")
      .eq("id", id)
      .maybeSingle(),
    "Conversation",
  ) as ConversationRow;
  return {
    id: row.id,
    title: row.title,
    updated_at: row.updated_at,
    turns: toTurns(
      row.messages as Anthropic.MessageParam[],
      row.cards as Record<string, AssistantCard>,
    ),
  };
}

export async function deleteConversation(db: Db, id: string): Promise<void> {
  const deleted = unwrap(
    await db.from("ai_conversations").delete().eq("id", id).select("id"),
    "Conversation",
  );
  if (deleted.length === 0) throw notFound("The conversation does not exist.");
}

/** Account deletion: uploads are not rows, so they do not cascade with the user. */
export async function removeAllUploads(db: Db, userId: string): Promise<void> {
  const { data } = await db.storage.from(AI_BUCKET).list(userId, { limit: 1000 });
  if (data && data.length > 0) {
    await db.storage.from(AI_BUCKET).remove(data.map((file) => `${userId}/${file.name}`));
  }
}
