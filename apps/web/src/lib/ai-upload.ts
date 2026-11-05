import type { AiExtraction, AiExtractionKind } from "@elacharger/schemas";
import { api, apiErrorMessage } from "./api";

// IA1 and IA2 from the browser: the file goes straight to the private bucket with a signed URL
// (as a phone app would), then the server reads it and returns a draft to confirm.

const READABLE = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIDE = 2000;
const SMALL_ENOUGH = 1.5 * 1024 * 1024;

/**
 * Photos are scaled down and re-encoded as JPEG on the device: faster on mobile data, and
 * formats the AI cannot read (HEIC) become JPEG where the browser can decode them.
 */
async function prepare(file: File): Promise<Blob> {
  if (file.type === "application/pdf") return file;
  if (READABLE.includes(file.type) && file.size <= SMALL_ENOUGH) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode"))),
      "image/jpeg",
      0.85,
    ),
  );
}

export type ExtractOutcome =
  { ok: true; extraction: AiExtraction } | { ok: false; message: string };

export async function extractFromFile(kind: AiExtractionKind, file: File): Promise<ExtractOutcome> {
  let blob: Blob;
  try {
    blob = await prepare(file);
  } catch {
    return { ok: false, message: "No pudimos abrir esa imagen. Prueba con una foto JPG o PNG." };
  }
  const contentType = blob.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  if (contentType !== "application/pdf" && !READABLE.includes(contentType)) {
    return { ok: false, message: "Sube un PDF o una foto JPG, PNG o WebP." };
  }
  if (contentType === "application/pdf" && kind === "charging_receipt") {
    return { ok: false, message: "Para una recarga, sube una foto." };
  }
  const limit = contentType === "application/pdf" ? 10 : 5;
  if (blob.size > limit * 1024 * 1024) {
    return { ok: false, message: `El archivo pesa más de ${limit} MB.` };
  }

  const upload = await api.POST("/ai/uploads", {
    body: { kind, content_type: contentType, size_bytes: blob.size },
  });
  if (!upload.data) return { ok: false, message: apiErrorMessage(upload.response.status) };

  try {
    const put = await fetch(upload.data.signed_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!put.ok) throw new Error(String(put.status));
  } catch {
    return { ok: false, message: "No pudimos subir el archivo. Revisa tu conexión." };
  }

  const extraction = await api.POST("/ai/extractions", {
    params: { header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { kind, path: upload.data.path },
  });
  if (!extraction.data) return { ok: false, message: apiErrorMessage(extraction.response.status) };
  return { ok: true, extraction: extraction.data };
}

/** The user kept or threw away the draft; best effort, it only feeds the history. */
export async function settleExtraction(id: string, status: "confirmed" | "discarded") {
  await api.PATCH("/ai/extractions/{id}", { params: { path: { id } }, body: { status } });
}
