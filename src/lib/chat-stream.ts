import stateKey from "./state-key.ts";
import { loadConfig } from "./config.ts";
import { basename } from "node:path";
import getRedisClient from "./redis.ts";

const encoder = new TextEncoder();
const frame = (value: unknown) =>
  encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Relays public SSE fields and records ownership before exposing conversation IDs. */
export default function chatStream(
  body: ReadableStream<Uint8Array>,
  session: string,
  release: () => Promise<unknown>,
  abort: () => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bytes = 0;
  let ended = false;
  let released = false;
  const finish = async () => {
    if (released) return;
    released = true;
    abort();
    await reader.cancel().catch(() => undefined);
    await release().catch(() => undefined);
  };
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const redis = await getRedisClient();
        const emit = async (line: string) => {
          if (!line.startsWith("data:")) return;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") return;
          const data = JSON.parse(raw);
          const id =
            data.type === "id"
              ? data.id
              : data.type === "message_id"
                ? data.conversation_id
                : null;
          if (id) {
            if (typeof id !== "string" || !uuid.test(id))
              throw new Error("invalid_conversation");
            const key = stateKey(`owner:${id}`);
            await redis.set(key, session, { NX: true, EX: 86_400 });
            if ((await redis.get(key)) !== session)
              throw new Error("invalid_conversation");
            controller.enqueue(frame({ type: "id", id }));
          } else if (data.type === "source" && Array.isArray(data.source)) {
            const sources = data.source
              .slice(0, 8)
              .flatMap((source: Record<string, unknown>) => {
                try {
                  const url = new URL(String(source.source));
                  const links = loadConfig().links;
                  if (
                    url.protocol !== "https:" ||
                    !links.allowedHosts.includes(url.hostname) ||
                    !links.allowedPaths.some(
                      (path) =>
                        url.pathname === path ||
                        (path.endsWith("/") && url.pathname.startsWith(path)),
                    ) ||
                    url.username ||
                    url.password
                  )
                    return [];
                  return [
                    {
                      title: String(source.title ?? "").slice(0, 200),
                      text: "",
                      source: url.href,
                    },
                  ];
                } catch {
                  const knowledge = loadConfig().knowledge;
                  const name = basename(String(source.source));
                  if (
                    knowledge.mode === "file" &&
                    name === basename(knowledge.file ?? "")
                  ) {
                    return [
                      {
                        title: String(source.title ?? name).slice(0, 200),
                        text: "",
                        source: name,
                      },
                    ];
                  }
                  return [];
                }
              });
            controller.enqueue(frame({ type: "source", source: sources }));
          } else if (
            (data.type === "answer" || !data.type) &&
            typeof data.answer === "string"
          ) {
            controller.enqueue(frame({ type: "answer", answer: data.answer }));
          } else if (data.type === "guardrail") {
            controller.enqueue(
              frame({ type: "guardrail", retract: Boolean(data.retract) }),
            );
          } else if (data.type === "error") {
            throw new Error("upstream_error");
          } else if (data.type === "end") {
            ended = true;
            controller.enqueue(frame({ type: "end" }));
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 1_000_000) throw new Error("response_too_large");
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 65_536) throw new Error("event_too_large");
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) await emit(line.trim());
        }
        if (buffer.trim()) await emit(buffer.trim());
        if (!ended) throw new Error("interrupted");
      } catch {
        if (!released)
          controller.enqueue(
            frame({
              type: "error",
              error:
                "The answer could not be completed. Please retry or use the support link.",
            }),
          );
      } finally {
        await finish();
        if (!released) return;
        try {
          controller.close();
        } catch {
          /* Visitor cancelled. */
        }
      }
    },
    async cancel() {
      await finish();
    },
  });
}
