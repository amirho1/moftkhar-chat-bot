import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeSecrets } from "../scripts/init-secrets.ts";
import { loadConfig, parseEnv } from "../src/lib/config.ts";
import {
  chatInput,
  chatSession,
  hasChatOrigin,
  readChatInput,
} from "../src/lib/chat-policy.ts";

test("secret setup is repeatable and preserves unrelated configuration", () => {
  const directory = mkdtempSync(join(tmpdir(), "starter-secrets-"));
  const path = join(directory, ".env");
  writeFileSync(
    path,
    "# local comment\nSITE_LABEL=My demo\nJWT_SECRET_KEY=existing-signing-key\n",
  );
  const first = initializeSecrets(path);
  const original = readFileSync(path, "utf8");
  const second = initializeSecrets(path);
  assert.equal(first.values.JWT_SECRET_KEY, "existing-signing-key");
  assert.equal(second.generated.length, 0);
  assert.equal(readFileSync(path, "utf8"), original);
  assert.match(original, /# local comment/);
  assert.equal(parseEnv(original).SITE_LABEL, "My demo");
});

test("public defaults are fictional and configurable without secrets", () => {
  const config = loadConfig();
  assert.equal(config.organization.website, "https://example.com");
  assert.equal(config.ui.locale, "fa");
  assert.equal(config.knowledge.mode, "file");
  assert(!JSON.stringify(config).includes("api_key"));
});

test("gateway refuses model/agent/tool overrides and arbitrary conversation paths", () => {
  for (const field of [
    "agent",
    "model",
    "system_prompt",
    "tools",
    "sources",
    "attachments",
    "url",
  ])
    assert.equal(
      chatInput.safeParse({ question: "سلام", [field]: "override" }).success,
      false,
    );
  assert.equal(
    chatInput.safeParse({ question: "سلام", api_key: "other-agent" }).success,
    false,
  );
  assert.equal(
    chatInput.safeParse({ question: "سلام", conversation_id: "../admin" })
      .success,
    false,
  );
  assert.equal(
    chatInput.safeParse({ question: "a".repeat(2001) }).success,
    false,
  );
});

test("bounded input does not trust a missing Content-Length", async () => {
  await assert.rejects(
    readChatInput(
      new Request("https://example.com/stream", {
        method: "POST",
        body: "x".repeat(65537),
      }),
    ),
    /invalid_input/,
  );
});

test("anonymous cookies are signed and origins are explicit", () => {
  const session = chatSession(undefined, "local-test-secret");
  assert.equal(chatSession(session.cookie, "local-test-secret").id, session.id);
  assert.notEqual(
    chatSession(session.cookie, "another-test-secret").id,
    session.id,
  );
  assert.equal(
    hasChatOrigin(
      new Request("https://example.com/stream", {
        headers: {
          origin: "https://evil.example",
          "content-type": "application/json",
        },
      }),
      ["https://example.com"],
    ),
    false,
  );
});
