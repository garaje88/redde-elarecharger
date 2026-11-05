import Anthropic from "@anthropic-ai/sdk";
import { AssistantRequestSchema, type AssistantEvent } from "@elacharger/schemas";
import { authedHandler } from "@/server/auth";
import { ApiError, parseBody } from "@/server/http";
import { prepareAssistantTurn } from "@/server/services/ai";

// Several tool calls (route, elevation, engine) plus the model's answers.
export const maxDuration = 120;

/** Failures after the stream started travel as an `error` event instead of a status code. */
function errorEvent(error: unknown): AssistantEvent {
  if (error instanceof ApiError) {
    return { type: "error", status: error.status, detail: error.detail ?? error.title };
  }
  if (error instanceof Anthropic.APIError && error.status === 400) {
    return { type: "error", status: 422, detail: "The conversation history was not accepted." };
  }
  if (error instanceof Anthropic.APIError) {
    return {
      type: "error",
      status: 503,
      detail: "The assistant is unavailable. Try again shortly.",
    };
  }
  console.error("Assistant failed", error);
  return { type: "error", status: 500, detail: "Unexpected error. Try again later." };
}

/** Server-Sent Events: `data: <AssistantEvent JSON>` per event, ending with `done` or `error`. */
export const POST = authedHandler(async (request, { supabase, user }) => {
  const input = await parseBody(request, AssistantRequestSchema);
  const turn = await prepareAssistantTurn(supabase, user.id, input);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AssistantEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The client went away; request.signal stops the model call.
        }
      };
      try {
        await turn(emit, request.signal);
      } catch (error) {
        if (!request.signal.aborted) emit(errorEvent(error));
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
});
