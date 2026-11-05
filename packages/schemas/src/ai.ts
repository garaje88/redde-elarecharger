import { z } from "zod";
import { ChargeEstimateSchema } from "./charge";
import { FieldConfidenceSchema, SubmissionSchema } from "./catalog";
import { SessionStatsSchema } from "./sessions";
import { TripEstimateSchema } from "./trip";

// docs/PLAN.md, Funcionalidades de IA. The AI reads and extracts; numbers come from packages/calc.

export const AI_UPLOAD_LIMITS = {
  "application/pdf": 10 * 1024 * 1024,
  "image/jpeg": 5 * 1024 * 1024,
  "image/png": 5 * 1024 * 1024,
  "image/webp": 5 * 1024 * 1024,
} as const;

export const AiUploadContentTypeSchema = z
  .enum(["application/pdf", "image/jpeg", "image/png", "image/webp"])
  .meta({ id: "AiUploadContentType" });

export const AiExtractionKindSchema = z.enum(["vehicle_spec", "charging_receipt"]).meta({
  id: "AiExtractionKind",
  description:
    "vehicle_spec: a technical sheet (IA1). charging_receipt: a photo of a charge (IA2).",
});

export const AiUploadRequestSchema = z
  .object({
    kind: AiExtractionKindSchema,
    content_type: AiUploadContentTypeSchema,
    size_bytes: z.number().int().min(1),
  })
  .refine((r) => r.size_bytes <= AI_UPLOAD_LIMITS[r.content_type], {
    path: ["size_bytes"],
    message: "PDFs up to 10 MB and images up to 5 MB.",
  })
  .refine((r) => r.kind === "vehicle_spec" || r.content_type !== "application/pdf", {
    path: ["content_type"],
    message: "Charging receipts must be photos.",
  })
  .meta({ id: "AiUploadRequest" });

export const AiUploadSchema = z
  .object({
    path: z.string().meta({ description: "Pass to POST /ai/extractions after uploading." }),
    signed_url: z
      .url()
      .meta({ description: "PUT the file here (Supabase Storage signed upload)." }),
    token: z.string(),
  })
  .meta({ id: "AiUpload" });

export const CreateExtractionSchema = z
  .object({ kind: AiExtractionKindSchema, path: z.string().min(1).max(300) })
  .meta({ id: "CreateExtraction" });

/** IA2: what a charger screen, receipt or dashboard photo can tell. null = not visible. */
export const ReceiptDraftSchema = z
  .object({
    energy_kwh: z.number().min(0).max(999_999).nullable(),
    cost: z.number().min(0).max(9_999_999_999).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    start_soc: z.number().min(0).max(100).nullable(),
    end_soc: z.number().min(0).max(100).nullable(),
    started_at: z.iso.datetime({ offset: true }).nullable(),
    ended_at: z.iso.datetime({ offset: true }).nullable(),
    odometer_km: z.number().min(0).max(9_999_999).nullable(),
    location_label: z.string().max(300).nullable(),
  })
  .meta({ id: "ReceiptDraft" });

const extractionBase = {
  id: z.uuid(),
  status: z.enum(["pending", "confirmed", "discarded"]),
  model: z.string(),
  confidence: FieldConfidenceSchema,
  created_at: z.iso.datetime({ offset: true }),
};

export const AiExtractionSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("charging_receipt"),
      ...extractionBase,
      draft: ReceiptDraftSchema,
    }),
    z.object({
      kind: z.literal("vehicle_spec"),
      ...extractionBase,
      submission: SubmissionSchema.nullable().meta({
        description: "Confirm it with POST /catalog/submissions/{id}/confirm.",
      }),
    }),
  ])
  .meta({ id: "AiExtraction" });

export const UpdateExtractionSchema = z
  .object({ status: z.enum(["confirmed", "discarded"]) })
  .meta({ id: "UpdateExtraction" });

export const AiUsageSummarySchema = z
  .object({
    available: z.boolean().meta({ description: "false without an API key or over the budget." }),
    extractions_today: z.number().int(),
    extractions_limit: z.number().int(),
    messages_today: z.number().int(),
    messages_limit: z.number().int(),
  })
  .meta({ id: "AiUsageSummary" });

// Assistant (IA3) ------------------------------------------------------------------------

/** Results the assistant shows as cards; the numbers come from the same services as the app. */
export const AssistantCardSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("trip"),
      trip: TripEstimateSchema.omit({ route: true }).extend({
        distance_km: z.number(),
        duration_min: z.number(),
      }),
    }),
    z.object({ kind: z.literal("charge"), charge: ChargeEstimateSchema.omit({ curve: true }) }),
    z.object({ kind: z.literal("stats"), stats: SessionStatsSchema.omit({ monthly: true }) }),
  ])
  .meta({ id: "AssistantCard" });

export const AssistantTurnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: z.string(),
    cards: z.array(AssistantCardSchema),
  })
  .meta({ id: "AssistantTurn" });

export const AssistantRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    conversation_id: z.uuid().optional().meta({ description: "Continue a saved conversation." }),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.unknown() }))
      .max(60)
      .optional()
      .meta({
        description:
          "When the user does not save conversations: the `history` of the previous `done` event, unchanged.",
      }),
  })
  .refine((r) => !(r.conversation_id && r.history), {
    path: ["history"],
    message: "Send either conversation_id or history.",
  })
  .meta({ id: "AssistantRequest" });

/** One Server-Sent Event of POST /ai/assistant (`data:` lines carry this JSON). */
export const AssistantEventSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({
      type: z.literal("tool"),
      name: z.string().meta({ description: "The tool the assistant is running." }),
    }),
    z.object({ type: z.literal("card"), card: AssistantCardSchema }),
    z.object({
      type: z.literal("done"),
      conversation_id: z.uuid().nullable(),
      history: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.unknown() }))
        .nullable()
        .meta({ description: "Only when conversations are not saved; send it back next turn." }),
    }),
    z.object({
      type: z.literal("error"),
      status: z.number().int(),
      detail: z.string(),
    }),
  ])
  .meta({ id: "AssistantEvent" });

export const ConversationSummarySchema = z
  .object({ id: z.uuid(), title: z.string(), updated_at: z.iso.datetime({ offset: true }) })
  .meta({ id: "ConversationSummary" });

export const ConversationListSchema = z
  .object({ items: z.array(ConversationSummarySchema) })
  .meta({ id: "ConversationList" });

export const ConversationSchema = ConversationSummarySchema.extend({
  turns: z.array(AssistantTurnSchema),
}).meta({ id: "Conversation" });

export type AiUploadContentType = z.infer<typeof AiUploadContentTypeSchema>;
export type AiUploadRequest = z.infer<typeof AiUploadRequestSchema>;
export type AiUpload = z.infer<typeof AiUploadSchema>;
export type AiExtractionKind = z.infer<typeof AiExtractionKindSchema>;
export type CreateExtraction = z.infer<typeof CreateExtractionSchema>;
export type ReceiptDraft = z.infer<typeof ReceiptDraftSchema>;
export type AiExtraction = z.infer<typeof AiExtractionSchema>;
export type AiUsageSummary = z.infer<typeof AiUsageSummarySchema>;
export type AssistantCard = z.infer<typeof AssistantCardSchema>;
export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type AssistantEvent = z.infer<typeof AssistantEventSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
