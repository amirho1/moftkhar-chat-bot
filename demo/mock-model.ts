/** Explicit local test fixture. This is not an AI model or production provider. */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

createServer(async (request, response) => {
  if (request.url === "/v1/models") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ object: "list", data: [{ id: "starter-mock", object: "model", owned_by: "fictional-test-fixture" }] }));
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") { response.writeHead(404); response.end(); return; }
  let raw = "";
  for await (const chunk of request) { raw += chunk; if (raw.length > 1_000_000) { response.writeHead(413); response.end(); return; } }
  const body = JSON.parse(raw);
  const answer = "این یک پاسخ ساختگی برای آزمون اتصال است، نه پاسخ یک مدل واقعی. پلن خیالی نمونه ۱۴ روز اعتبار دارد. [1]";
  const id = `chatcmpl-fixture-${randomUUID()}`;
  if (body.stream) {
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    for (const [delta, finish] of [[{ role: "assistant", content: answer }, null], [{}, "stop"]] as const) response.write(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 0, model: "starter-mock", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`);
    response.end("data: [DONE]\n\n");
  } else {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ id, object: "chat.completion", model: "starter-mock", choices: [{ index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  }
}).listen(8090, process.env.MOCK_BIND_HOST ?? "127.0.0.1", () => console.log('{"event":"fictional_mock_model_ready","production":false}'));
