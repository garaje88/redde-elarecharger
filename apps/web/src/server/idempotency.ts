import "server-only";
import type { Json } from "@elacharger/types";
import type { NextRequest } from "next/server";
import type { AuthContext } from "./auth";
import { dbError } from "./db";
import { ApiError } from "./http";

/** Replays are honoured for 24 h, like Stripe's keys. */
export const IDEMPOTENCY_TTL_MS = 86_400_000;
const KEY = /^[\x21-\x7e]{1,255}$/;

type Handler<Ctx> = (request: NextRequest, auth: AuthContext, context: Ctx) => Promise<Response>;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Wraps a POST that creates a record. With an `Idempotency-Key` header, the first successful
 * response is stored and replayed for retries carrying the same key and body, so a flaky mobile
 * connection never creates a record twice. Failed attempts are forgotten and can be retried.
 */
export function idempotent<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, auth, context) => {
    const key = request.headers.get("idempotency-key");
    if (key === null) return handler(request, auth, context);
    if (!KEY.test(key)) {
      throw new ApiError(400, "Bad Request", {
        detail: "Idempotency-Key must be 1–255 visible ASCII characters.",
      });
    }

    const { supabase, user } = auth;
    const hash = await sha256(
      `${request.method} ${request.nextUrl.pathname}\n${await request.clone().text()}`,
    );

    const { data: stored, error } = await supabase
      .from("idempotency_keys")
      .select("request_hash, response_status, response_body, created_at")
      .eq("user_id", user.id)
      .eq("key", key)
      .maybeSingle();
    if (error) throw dbError(error, "Idempotency key");

    if (stored && Date.parse(stored.created_at) > Date.now() - IDEMPOTENCY_TTL_MS) {
      if (stored.request_hash !== hash) {
        throw new ApiError(422, "Unprocessable Content", {
          detail: "This Idempotency-Key was already used with a different request.",
        });
      }
      if (stored.response_status === null) {
        throw new ApiError(409, "Conflict", {
          detail: "A request with this Idempotency-Key is still in progress.",
        });
      }
      return Response.json(stored.response_body, {
        status: stored.response_status,
        headers: { "Cache-Control": "no-store", "Idempotent-Replayed": "true" },
      });
    }
    if (stored)
      await supabase.from("idempotency_keys").delete().eq("user_id", user.id).eq("key", key);

    const claimed = await supabase
      .from("idempotency_keys")
      .insert({ user_id: user.id, key, request_hash: hash });
    if (claimed.error) {
      // A concurrent request with the same key won the insert.
      if (claimed.error.code === "23505") {
        throw new ApiError(409, "Conflict", {
          detail: "A request with this Idempotency-Key is still in progress.",
        });
      }
      throw dbError(claimed.error, "Idempotency key");
    }

    const forget = () =>
      supabase.from("idempotency_keys").delete().eq("user_id", user.id).eq("key", key);
    let response: Response;
    try {
      response = await handler(request, auth, context);
    } catch (thrown) {
      await forget();
      throw thrown;
    }
    if (!response.ok) {
      await forget();
      return response;
    }
    const body = (await response.clone().json()) as Json;
    await supabase
      .from("idempotency_keys")
      .update({ response_status: response.status, response_body: body })
      .eq("user_id", user.id)
      .eq("key", key);
    return response;
  };
}
