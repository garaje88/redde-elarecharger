// Simulated Claude API for E2E (docs/PLAN.md phase 8). The app reaches it through
// ANTHROPIC_BASE_URL. Extractions answer with the recorded eval answers; the assistant follows a
// small script: it calls estimate_trip or get_stats and then repeats the tool's numbers, as the
// real model is told to. It never computes anything itself.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const port = Number(process.env.ANTHROPIC_MOCK_PORT ?? 3202);
const recorded = (file) =>
  JSON.parse(
    readFileSync(new URL(`../../../apps/web/test/ai-evals/recorded/${file}.json`, import.meta.url)),
  ).raw;
const SHEET = recorded("byd-dolphin.webp");
const RECEIPT = recorded("celsia-receipt.webp");

const usage = { input_tokens: 1200, output_tokens: 80 };
const message = (content, stopReason) => ({
  id: `msg_${Date.now()}`,
  type: "message",
  role: "assistant",
  model: "claude-mock",
  content,
  stop_reason: stopReason,
  stop_sequence: null,
  usage,
});

/** What the scripted assistant does next, from the last user message. */
function nextTurn(body) {
  const last = body.messages.at(-1);
  const blocks =
    typeof last.content === "string" ? [{ type: "text", text: last.content }] : last.content;
  const result = blocks.find((b) => b.type === "tool_result");
  if (result) {
    const data = JSON.parse(typeof result.content === "string" ? result.content : "{}");
    if (result.is_error) return { text: `No pude calcularlo: ${result.content}` };
    if ("arrival_soc" in data) {
      return {
        text: `${data.reachable ? "Sí llegas" : "No llegas"}. La ruta tiene ${data.distance_km} km y llegas con ${data.arrival_soc} %.`,
      };
    }
    return { text: `Este mes llevas ${data.month_sessions} recargas.` };
  }
  const text = blocks.map((b) => b.text ?? "").join(" ");
  if (/girardot/i.test(text)) {
    const soc = Number(/(\d{1,3})\s*%/.exec(text)?.[1] ?? 80);
    return {
      tool: {
        name: "estimate_trip",
        input: { origin: "Bogotá", destination: "Girardot", start_soc: soc },
      },
    };
  }
  if (/consumo/i.test(text)) return { tool: { name: "get_stats", input: {} } };
  return { text: "Solo te ayudo con trayectos y carga de tu carro eléctrico." };
}

function streamTurn(res, turn) {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const send = (type, data) =>
    res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  send("message_start", { message: message([], null) });
  if (turn.tool) {
    send("content_block_start", {
      index: 0,
      content_block: {
        type: "tool_use",
        id: `toolu_${Date.now()}`,
        name: turn.tool.name,
        input: {},
      },
    });
    send("content_block_delta", {
      index: 0,
      delta: { type: "input_json_delta", partial_json: JSON.stringify(turn.tool.input) },
    });
  } else {
    send("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    // In pieces, like the real stream.
    for (const piece of turn.text.match(/.{1,12}/gs) ?? []) {
      send("content_block_delta", { index: 0, delta: { type: "text_delta", text: piece } });
    }
  }
  send("content_block_stop", { index: 0 });
  send("message_delta", {
    delta: { stop_reason: turn.tool ? "tool_use" : "end_turn", stop_sequence: null },
    usage: { output_tokens: 40 },
  });
  send("message_stop", {});
  res.end();
}

createServer((req, res) => {
  const json = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.url === "/health") return json(200, { ok: true });
  if (!req.headers["x-api-key"] && !req.headers.authorization)
    return json(401, { type: "error", error: { type: "authentication_error" } });
  if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) return json(404, {});
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const body = JSON.parse(raw);
    if (body.stream) return streamTurn(res, nextTurn(body));
    const system = typeof body.system === "string" ? body.system : "";
    // The web lookup (phase 3) finds nothing, so its E2E keeps covering the manual path.
    const lookup = body.tools?.some((tool) => tool.name === "web_search");
    const answer = lookup
      ? { ...SHEET, found: false }
      : system.includes("technical sheets")
        ? SHEET
        : RECEIPT;
    return json(200, message([{ type: "text", text: JSON.stringify(answer) }], "end_turn"));
  });
}).listen(port, () => console.log(`Claude mock on ${port}`));
