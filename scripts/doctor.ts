import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadLocalEnv, loadConfig } from "../src/lib/config.ts";

loadLocalEnv();
let failed = false;
const report = (name: string, ok: boolean) => {
  console.log(`${ok ? "OK" : "MISSING/FAILED"} ${name}`);
  failed ||= !ok;
};
report(
  "Node 22.12+",
  Number(process.versions.node.split(".")[0]) === 22 &&
    Number(process.versions.node.split(".")[1]) >= 12,
);
report("Public starter configuration", Boolean(loadConfig()));
report("Local .env", existsSync(".env"));
for (const key of [
  "JWT_SECRET_KEY",
  "ENCRYPTION_SECRET_KEY",
  "INTERNAL_KEY",
  "CHAT_SESSION_SECRET",
  "DOCSGPT_MANAGEMENT_TOKEN",
])
  report(`${key} configured (value hidden)`, Boolean(process.env[key]));
report(
  "Chat provider configured (values hidden)",
  Boolean(
    process.env.API_KEY && process.env.OPENAI_BASE_URL && process.env.LLM_NAME,
  ),
);
try {
  const response = await fetch(
    (process.env.DOCSGPT_MANAGEMENT_URL ?? "http://127.0.0.1:7091") +
      "/api/health",
    { signal: AbortSignal.timeout(5000) },
  );
  report("DocsGPT API health", response.ok);
} catch {
  report("DocsGPT API health", false);
}
for (const name of ["docker", "uv", "initdb", "pg_ctl", "redis-server"])
  console.log(
    `${spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0 ? "AVAILABLE" : "NOT FOUND"} ${name} (mode-dependent)`,
  );
const statusFile = resolve(
  process.env.STARTER_STATE_DIR ?? ".runtime/state",
  "bootstrap-status.json",
);
if (existsSync(statusFile)) {
  const status = JSON.parse(readFileSync(statusFile, "utf8"));
  report("Initial indexing recorded", Boolean(status.lastSuccessfulIndex));
  console.log(
    `Agent state: ${status.agentStatus}; public chat enabled: ${process.env.CHAT_ENABLED === "true"}`,
  );
} else report("Initial knowledge indexing", false);
console.log(
  "Health checks do not prove model generation, retrieval, citations, worker operation, or production readiness. Run the documented end-to-end checks.",
);
process.exitCode = failed ? 1 : 0;
