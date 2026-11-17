import { mkdirSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { run, runtimeEnv } from "./runtime.ts";

const { env, values } = runtimeEnv("native");
const database = new URL(values.POSTGRES_URI);
if (
  database.hostname !== "127.0.0.1" ||
  database.port !== "55432" ||
  database.pathname !== "/chatbot"
)
  throw new Error(
    "Native auto-init only supports the dedicated localhost:55432/chatbot sandbox. Configure external services manually.",
  );
const data = resolve(".runtime/postgres");
mkdirSync(".runtime/redis", { recursive: true });
if (!existsSync(`${data}/PG_VERSION`)) {
  const passwordFile = resolve(".runtime/postgres-password.once");
  writeFileSync(passwordFile, values.POSTGRES_PASSWORD, {
    mode: 0o600,
    flag: "wx",
  });
  try {
    run(
      "initdb",
      [
        "-D",
        data,
        "-U",
        "chatbot",
        "--auth-host=scram-sha-256",
        "--auth-local=trust",
        `--pwfile=${passwordFile}`,
      ],
      undefined,
      env,
    );
  } finally {
    unlinkSync(passwordFile);
  }
}
if (
  spawnSync("pg_ctl", ["-D", data, "status"], { stdio: "ignore" }).status !== 0
)
  run(
    "pg_ctl",
    [
      "-D",
      data,
      "-l",
      resolve(".runtime/postgres.log"),
      "-o",
      "-h 127.0.0.1 -p 55432",
      "start",
    ],
    undefined,
    env,
  );
const pgEnv = { ...env, PGPASSWORD: values.POSTGRES_PASSWORD };
const query = spawnSync(
  "psql",
  [
    "-h",
    "127.0.0.1",
    "-p",
    "55432",
    "-U",
    "chatbot",
    "-d",
    "postgres",
    "-tAc",
    "SELECT 1 FROM pg_database WHERE datname='chatbot'",
  ],
  { env: pgEnv, encoding: "utf8" },
);
if (query.status !== 0)
  throw new Error(
    "Cannot authenticate to the dedicated database; no data was replaced",
  );
if (!query.stdout.includes("1"))
  run(
    "createdb",
    ["-h", "127.0.0.1", "-p", "55432", "-U", "chatbot", "chatbot"],
    undefined,
    pgEnv,
  );
const redis = spawnSync(
  "redis-cli",
  ["-h", "127.0.0.1", "-p", "56379", "ping"],
  { encoding: "utf8" },
);
if (redis.status !== 0)
  run("redis-server", [
    "--bind",
    "127.0.0.1",
    "--port",
    "56379",
    "--dir",
    resolve(".runtime/redis"),
    "--appendonly",
    "yes",
    "--daemonize",
    "yes",
    "--pidfile",
    resolve(".runtime/redis.pid"),
    "--logfile",
    resolve(".runtime/redis.log"),
  ]);
console.log(
  "Dedicated PostgreSQL and Redis services are ready; existing services were not stopped or recreated.",
);
