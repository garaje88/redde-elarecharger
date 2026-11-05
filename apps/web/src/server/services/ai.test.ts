import type Anthropic from "@anthropic-ai/sdk";
import type { AssistantCard } from "@elacharger/schemas";
import { describe, expect, it } from "vitest";
import { toTurns } from "./ai";

const card = { kind: "stats", stats: { month: "2026-11" } } as unknown as AssistantCard;

describe("toTurns", () => {
  it("rebuilds the visible conversation from the model transcript", () => {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: "¿Cómo voy este mes?" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: "Reviso tus recargas. " },
          { type: "tool_use", id: "toolu_1", name: "get_stats", input: {} },
        ],
      },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "{}" }],
      },
      { role: "assistant", content: [{ type: "text", text: "Vas en 15,2 kWh/100 km." }] },
      { role: "user", content: "Gracias" },
    ];
    expect(toTurns(messages, { toolu_1: card })).toEqual([
      { role: "user", text: "¿Cómo voy este mes?", cards: [] },
      { role: "assistant", text: "Reviso tus recargas. Vas en 15,2 kWh/100 km.", cards: [card] },
      { role: "user", text: "Gracias", cards: [] },
    ]);
  });
});
