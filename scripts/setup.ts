import { initializeSecrets } from "./init-secrets.ts";
import { spawnSync } from "node:child_process";
import {
  checkoutSource,
  run,
  runtimeEnv,
  sourceDir,
  type Mode,
} from "./runtime.ts";

const mode = process.argv
  .find((arg) => arg.startsWith("--mode="))
  ?.split("=")[1] as Mode;
if (!["docker", "native"].includes(mode))
  throw new Error("Use npm run setup -- --mode=docker or --mode=native");
initializeSecrets(".env");
if (mode === "docker") {
  const info = spawnSync("docker", ["info", "--format", "{{.MemTotal}}"], {
    encoding: "utf8",
  });
  if (info.status !== 0)
    throw new Error(
      "Docker Engine is unavailable; start it and retry. Existing services were not changed.",
    );
  if (Number(info.stdout.trim()) < 4 * 1024 ** 3)
    throw new Error(
      "Docker has less than 4 GiB memory available. Increase its resource allocation or use native mode; this starter will not alter your Docker settings.",
    );
}
const mock = process.argv.includes("--mock-model");
const { file, env } = runtimeEnv(mode, { mock });
console.log(
  `Preparing ${mode} mode. Existing configuration and data are preserved; credentials are never displayed.`,
);
checkoutSource();
if (mode === "docker") {
  const compose = [
    "compose",
    "--env-file",
    file,
    ...(mock ? ["--profile", "demo-model"] : []),
  ];
  run("docker", [...compose, "build"]);
  if (!process.argv.includes("--build-only"))
    run("docker", [...compose, "up", "-d"]);
} else {
  run(
    "uv",
    ["sync", "--frozen", "--no-dev", "--python", "3.12"],
    sourceDir,
    env,
  );
  run(
    "npm",
    ["ci", "--include=dev", "--ignore-scripts"],
    `${sourceDir}/frontend`,
  );
  run("bash", ["scripts/build_frontend.sh"], sourceDir, env);
  run(
    "npm",
    ["ci", "--include=dev", "--ignore-scripts"],
    `${sourceDir}/extensions/react-widget`,
  );
  run("npm", ["run", "build"], `${sourceDir}/extensions/react-widget`);
}
console.log(
  "Setup finished. Run the documented database/services step, doctor, and bootstrap. Public chat remains disabled until explicitly verified.",
);
