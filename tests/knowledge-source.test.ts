import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { loadConfig } from "../src/lib/config.ts";
import { selectKnowledgeSource } from "../scripts/knowledge-source.ts";

const name = loadConfig().knowledge.name;
const first = { id: "source-a", name, ownership: "user" };
const second = { id: "source-b", name, ownership: "user" };

test("source lookup permits creation only when no owned name matches", () => {
  assert.equal(selectKnowledgeSource([], name), undefined);
  assert.equal(
    selectKnowledgeSource([{ ...first, ownership: "system" }], name),
    undefined,
  );
  assert.equal(selectKnowledgeSource([first], name), first);
  assert.equal(selectKnowledgeSource([first], name, " "), first);
  assert.throws(
    () => selectKnowledgeSource([first, second], name),
    /Duplicate/,
  );
});

test("reviewed ID resolves duplicate names regardless of list order", () => {
  for (const sources of [
    [first, second],
    [second, first],
  ])
    assert.equal(selectKnowledgeSource(sources, name, second.id), second);
});

test("explicit IDs cannot fall back to creation or a different source", () => {
  for (const sources of [
    [],
    [first],
    [{ ...second, ownership: "system" }],
    [{ ...second, name: "Other knowledge" }],
    [second, { ...second }],
    [second, { ...second, ownership: "system" }],
  ])
    assert.throws(
      () => selectKnowledgeSource(sources, name, second.id),
      /DOCSGPT_SOURCE_ID/,
    );
});

test("invalid API responses and sanitized IDs stop source selection", () => {
  for (const sources of [null, {}, [null], [{}], [{ ...first, id: "" }]])
    assert.throws(() => selectKnowledgeSource(sources, name), /Unexpected/);
  for (const id of ["[REDACTED]", "prefix[MASKED_VALUE]suffix"])
    assert.throws(
      () => selectKnowledgeSource([first], name, id),
      /redaction marker/,
    );
});

test("bootstrap stops before writes on ambiguity and imports only a reviewed ID", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "starter-source-test-"));
  const requests: { method: string; path: string; body: any }[] = [];
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    requests.push({
      method: req.method!,
      path: req.url!,
      body: text ? JSON.parse(text) : undefined,
    });
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && req.url === "/api/sources")
      res.end(JSON.stringify([first, second]));
    else if (req.url === "/api/import_agent/plan")
      res.end(JSON.stringify({ success: true }));
    else if (req.url === "/api/import_agent")
      res.end(
        JSON.stringify({ success: true, agent_id: "draft", status: "draft" }),
      );
    else {
      res.statusCode = 400;
      res.end("{}");
    }
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const address = server.address() as { port: number };
  async function bootstrap(sourceId = "") {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/bootstrap.ts"],
      {
        cwd: resolve("."),
        env: {
          PATH: process.env.PATH,
          STARTER_ENV_FILE: join(stateDir, "absent.env"),
          STARTER_STATE_DIR: stateDir,
          STARTER_CONFIG: resolve("config/starter.json"),
          LLM_NAME: "fictional-test-model",
          OPENAI_BASE_URL: "https://provider.example.invalid/v1",
          API_KEY: "fictional-test-key",
          DOCSGPT_MANAGEMENT_URL: `http://127.0.0.1:${address.port}`,
          DOCSGPT_MANAGEMENT_TOKEN: "fictional-test-token",
          DOCSGPT_SOURCE_ID: sourceId,
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const code = await new Promise<number | null>((done, reject) => {
      child.once("error", reject);
      child.once("close", done);
    });
    return { code, output };
  }
  try {
    const ambiguous = await bootstrap();
    assert.notEqual(ambiguous.code, 0);
    assert.match(ambiguous.output, /Duplicate source identity requires review/);
    assert.deepEqual(
      requests.map((req) => req.method),
      ["GET"],
    );
    requests.length = 0;

    const missing = await bootstrap("missing-source");
    assert.notEqual(missing.code, 0);
    assert.deepEqual(
      requests.map((req) => req.method),
      ["GET"],
    );
    requests.length = 0;

    const selected = await bootstrap(second.id);
    assert.equal(selected.code, 0, selected.output);
    assert.deepEqual(
      requests.map((req) => req.path),
      ["/api/sources", "/api/import_agent/plan", "/api/import_agent"],
    );
    for (const request of requests.slice(1))
      assert.equal(
        JSON.parse(request.body.yaml).spec.sources[0].ref,
        second.id,
      );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    rmSync(stateDir, { recursive: true, force: true });
  }
});
