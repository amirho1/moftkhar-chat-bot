import stateKey from "./lib/state-key.ts";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { loadConfig, loadLocalEnv } from "./lib/config.ts";
import {
  chatNetworkKey,
  chatSession,
  hasChatOrigin,
  readChatInput,
} from "./lib/chat-policy.ts";
import reserveChat from "./lib/chat-limits.ts";
import chatStream from "./lib/chat-stream.ts";
import getRedis from "./lib/redis.ts";

loadLocalEnv();
const config = loadConfig();
const origin = new URL(process.env.PUBLIC_ORIGIN ?? "http://localhost:3080")
  .origin;
const cookieName = origin.startsWith("https:")
  ? "__Host-chatbot-session"
  : "chatbot-session";
const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Chatbot starter</title></head><body><h1 id="title"></h1><p id="intro"></p><a id="support">Support</a><div id="widget"></div><script src="/widget.js"></script><script src="/client.js"></script></body></html>`;
const client = `fetch('/config').then(r=>r.json()).then(c=>{document.documentElement.lang=c.ui.locale;document.documentElement.dir=c.ui.locale.toLowerCase().startsWith('fa')?'rtl':'ltr';document.title=c.ui.title;document.getElementById('title').textContent=c.ui.title;document.getElementById('intro').textContent=c.ui.greeting;document.getElementById('support').href=c.organization.supportUrl;window.renderDocsGPTWidget('widget',{apiHost:location.origin,apiKey:'',locale:c.ui.locale,theme:c.ui.theme,buttonBg:c.ui.color,title:c.ui.title,heroTitle:c.ui.greeting,heroDescription:c.ui.privacyHint,suggestedQuestions:c.ui.questions,persistConversations:false,showMicButton:false,collectFeedback:false,showSources:true});});`;

/** Public web entrypoint; management paths and arbitrary upstream operations do not exist. */
export const server = createServer(async (incoming, response) => {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  const send = (status: number, body: string, type = "application/json") => {
    response.writeHead(status, { ...headers, "Content-Type": type });
    response.end(body);
  };
  const path = incoming.url?.split("?")[0];
  try {
    if (incoming.method === "GET") {
      if (path === "/health")
        return send(
          200,
          JSON.stringify({
            status: "ok",
            chatEnabled: process.env.CHAT_ENABLED === "true",
          }),
        );
      if (path === "/") return send(200, html, "text/html; charset=utf-8");
      if (path === "/client.js")
        return send(200, client, "text/javascript; charset=utf-8");
      if (path === "/config")
        return send(
          200,
          JSON.stringify({ organization: config.organization, ui: config.ui }),
        );
      if (path === "/widget.js")
        return send(
          200,
          readFileSync(
            ".runtime/docsgpt/extensions/react-widget/dist/modern/browser.js",
            "utf8",
          ),
          "text/javascript; charset=utf-8",
        );
    }
    if (path !== "/stream" || incoming.method !== "POST")
      return send(404, '{"error":"not_found"}');
    if (process.env.CHAT_ENABLED !== "true")
      return send(503, '{"error":"chat_disabled"}');
    const requestHeaders = new Headers();
    for (const [name, value] of Object.entries(incoming.headers))
      if (value)
        requestHeaders.set(
          name,
          Array.isArray(value) ? value.join(",") : value,
        );
    const request = new Request(origin + "/stream", {
      method: "POST",
      headers: requestHeaders,
      body: Readable.toWeb(incoming) as ReadableStream,
      duplex: "half",
    } as RequestInit);
    if (!hasChatOrigin(request, [origin]))
      return send(403, '{"error":"origin_refused"}');
    const secret = process.env.CHAT_SESSION_SECRET;
    if (
      !secret ||
      secret.length < 32 ||
      !process.env.CHAT_AGENT_KEY ||
      !process.env.CHAT_BACKEND_URL
    )
      return send(503, '{"error":"not_configured"}');
    let input;
    try {
      input = await readChatInput(request);
    } catch {
      return send(400, '{"error":"invalid_input"}');
    }
    const cookies = Object.fromEntries(
      (incoming.headers.cookie ?? "")
        .split(";")
        .map((part) => part.trim().split("=")),
    );
    const session = chatSession(cookies[cookieName], secret);
    const redis = await getRedis();
    if (
      input.conversation_id &&
      (await redis.get(stateKey(`owner:${input.conversation_id}`))) !==
        session.id
    )
      return send(404, '{"error":"conversation_not_found"}');
    const ipHeader = process.env.CHAT_TRUSTED_IP_HEADER;
    const claimedIp = ipHeader
      ? requestHeaders.get(ipHeader)
      : incoming.socket.remoteAddress;
    const ip = claimedIp && isIP(claimedIp) ? claimedIp : "unknown";
    const release = await reserveChat(session.id, chatNetworkKey(ip, secret));
    if (!release) return send(429, '{"error":"rate_limited"}');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 85000);
    response.on("close", () => controller.abort());
    try {
      const upstream = await fetch(
        process.env.CHAT_BACKEND_URL.replace(/\/$/, "") + "/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          redirect: "error",
          signal: controller.signal,
          body: JSON.stringify({
            question: input.question,
            history: "[]",
            conversation_id: input.conversation_id ?? null,
            api_key: process.env.CHAT_AGENT_KEY,
          }),
        },
      );
      if (
        !upstream.ok ||
        !upstream.body ||
        !upstream.headers.get("content-type")?.includes("text/event-stream")
      )
        throw new Error("upstream_unavailable");
      const stream = chatStream(upstream.body, session.id, release, () => {
        clearTimeout(timeout);
        controller.abort();
      });
      response.writeHead(200, {
        ...headers,
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
        "Set-Cookie": `${cookieName}=${session.cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${origin.startsWith("https:") ? "; Secure" : ""}`,
      });
      Readable.fromWeb(stream as import("node:stream/web").ReadableStream).pipe(
        response,
      );
    } catch {
      clearTimeout(timeout);
      controller.abort();
      await release().catch(() => undefined);
      if (!response.headersSent) send(503, '{"error":"upstream_unavailable"}');
    }
  } catch {
    if (!response.headersSent) send(503, '{"error":"service_unavailable"}');
    else response.end();
  }
});

server.listen(
  Number(process.env.PORT ?? 3080),
  process.env.BIND_HOST ?? "127.0.0.1",
  () =>
    console.log(
      JSON.stringify({
        event: "starter_listening",
        port: Number(process.env.PORT ?? 3080),
      }),
    ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    setTimeout(() => process.exit(0), 1000).unref();
  });
