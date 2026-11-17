import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "../src/lib/config.ts";

export const sourceDir = resolve(".runtime/docsgpt");
export type Mode = "docker" | "native";

/** Run explicit argument arrays; never evaluate a shell command or print secret environment. */
export function run(
  command: string,
  args: string[],
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed; see the preceding non-secret diagnostic`,
    );
}

/** Both install modes derive their settings from the same stable root .env. */
export function runtimeEnv(mode: Mode, options: { mock?: boolean } = {}) {
  const values = parseEnv(readFileSync(".env", "utf8"));
  const lock = JSON.parse(readFileSync("source.lock.json", "utf8"));
  if (mode === "docker")
    Object.assign(values, {
      POSTGRES_URI: `postgresql://chatbot:${encodeURIComponent(values.POSTGRES_PASSWORD)}@postgres:5432/chatbot`,
      CELERY_BROKER_URL: "redis://redis:6379/0",
      CELERY_RESULT_BACKEND: "redis://redis:6379/1",
      CACHE_REDIS_URL: "redis://redis:6379/2",
      REDIS_URL: "redis://redis:6379/3",
      API_URL: "http://api:7091",
      DOCSGPT_MANAGEMENT_URL: "http://api:7091",
      CHAT_BACKEND_URL: "http://api:7091",
      DOCSGPT_SOURCE_CONTEXT: `${lock.repository}#${lock.revision}`,
      DOCSGPT_REPOSITORY: lock.repository,
      DOCSGPT_REVISION: lock.revision,
    });
  else
    Object.assign(values, {
      DOCSGPT_HOME: resolve(".runtime/data"),
      API_URL: "http://127.0.0.1:7091",
    });
  if (options.mock)
    Object.assign(values, {
      API_KEY: "fictional-local-mock",
      OPENAI_API_KEY: "fictional-local-mock",
      OPENAI_BASE_URL:
        mode === "docker"
          ? "http://mock-model:8090/v1"
          : "http://127.0.0.1:8090/v1",
      LLM_NAME: "mock",
      STARTER_MOCK_MODE: "true",
    });
  mkdirSync(".runtime", { recursive: true, mode: 0o700 });
  const file = resolve(`.runtime/${mode}.env`);
  writeFileSync(
    file,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  return {
    file,
    env: {
      ...process.env,
      ...values,
      DOCSGPT_ENV_FILE: file,
    } as NodeJS.ProcessEnv,
    values,
  };
}

/** Source revision is immutable; setup refuses to switch or overwrite an existing checkout. */
export function checkoutSource() {
  const lock = JSON.parse(readFileSync("source.lock.json", "utf8"));
  if (
    !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/.test(lock.repository) ||
    !/^[a-f0-9]{40}$/.test(lock.revision)
  )
    throw new Error("Invalid source lock");
  const check = spawnSync("git", ["-C", sourceDir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  if (check.status === 0) {
    const dirty = spawnSync("git", ["-C", sourceDir, "status", "--porcelain"], {
      encoding: "utf8",
    });
    if (dirty.stdout.trim() || check.stdout.trim() !== lock.revision)
      throw new Error(
        "Existing source differs from source.lock.json; preserve it and follow the update guide",
      );
    return;
  }
  mkdirSync(sourceDir, { recursive: true });
  run("git", ["init", sourceDir]);
  run("git", ["remote", "add", "origin", lock.repository], sourceDir);
  run("git", ["fetch", "--depth", "1", "origin", lock.revision], sourceDir);
  run("git", ["checkout", "--detach", "FETCH_HEAD"], sourceDir);
}
