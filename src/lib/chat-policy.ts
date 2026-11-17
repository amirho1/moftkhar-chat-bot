import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const chatInput = z
  .object({
    question: z.string().trim().min(1).max(2000),
    conversation_id: z.string().uuid().nullable().optional(),
    api_key: z.literal("").optional(),
    history: z.string().max(60_000).optional(),
  })
  .strict();

/** Reads a bounded body even when Content-Length is absent or untrusted. */
export async function readChatInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_input");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65_536) throw new Error("invalid_input");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return chatInput.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

/** Requires an exact configured browser origin; forwarded host headers are ignored. */
export function hasChatOrigin(request: Request, origins: string[]) {
  return (
    origins.includes(request.headers.get("origin") ?? "") &&
    request.headers.get("sec-fetch-site") !== "cross-site" &&
    request.headers.get("content-type")?.split(";")[0].trim() ===
      "application/json"
  );
}

/** Authenticates only the anonymous chat cookie, independent of customer identity. */
export function chatSession(cookie: string | undefined, secret: string) {
  const sign = (id: string) =>
    createHmac("sha256", secret).update(id).digest("hex");
  if (cookie) {
    const [id, signature] = cookie.split(".");
    if (
      z.string().uuid().safeParse(id).success &&
      /^[a-f0-9]{64}$/.test(signature ?? "")
    ) {
      const expected = sign(id);
      if (timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
        return { id, cookie };
    }
  }
  const id = randomUUID();
  return { id, cookie: `${id}.${sign(id)}` };
}

/** Keeps raw network identifiers out of Redis keys and logs. */
export function chatNetworkKey(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex");
}
