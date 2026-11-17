import { spawn } from "node:child_process";
import { run, runtimeEnv, sourceDir } from "./runtime.ts";
import { loadConfig } from "../src/lib/config.ts";

const mock = process.argv.includes("--mock-model");
const { env } = runtimeEnv("native", { mock });
const detached = process.platform !== "win32";
if (mock) {
  env.OPENAI_API_KEY = "mock";
  env.API_KEY = "mock";
}
run("uv", ["run", "--frozen", "docsgpt", "migrate"], sourceDir, env);
const processes = [
  spawn(
    "uv",
    [
      "run",
      "--frozen",
      "docsgpt",
      "dev",
      "--no-reload",
      ...(mock ? ["--mock-llm"] : []),
    ],
    {
      cwd: sourceDir,
      env,
      stdio: "inherit",
      detached,
    },
  ),
  spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    env: { ...env, STARTER_ENV_FILE: ".runtime/native.env" },
    stdio: "inherit",
    detached,
  }),
  ...(loadConfig().knowledge.mode === "website"
    ? [
        spawn(process.execPath, ["--import", "tsx", "scripts/sync.ts"], {
          env,
          stdio: "inherit",
          detached,
        }),
      ]
    : []),
];
let closing = false;
const close = () => {
  if (!closing) {
    closing = true;
    for (const child of processes) {
      try {
        if (detached && child.pid) process.kill(-child.pid, "SIGTERM");
        else child.kill("SIGTERM");
      } catch {
        /* Child already exited. */
      }
    }
  }
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
for (const child of processes)
  child.on("exit", (code) => {
    if (!closing) {
      process.exitCode = code || 1;
      close();
    }
  });
