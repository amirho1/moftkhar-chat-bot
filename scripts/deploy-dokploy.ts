import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Pins a reviewed private template to verified registry digests and forbids server-side builds. */
export function prepareDeployment(
  template: string,
  backend: string,
  gateway: string,
) {
  const digest = /^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/;
  if (!digest.test(backend) || !digest.test(gateway))
    throw new Error("Verified GHCR image digests are required");
  const doc = JSON.parse(template);
  if (!doc.services || typeof doc.services !== "object")
    throw new Error("Missing services");
  let replacements = 0;
  for (const service of Object.values(doc.services) as Record<string, any>[]) {
    if (service.build)
      throw new Error(
        "Production template must not build on the target server",
      );
    if (service.image === "__DOCSGPT_IMAGE__") {
      service.image = backend;
      replacements++;
      service.pull_policy = "always";
    }
    if (service.image === "__GATEWAY_IMAGE__") {
      service.image = gateway;
      replacements++;
      service.pull_policy = "always";
    }
    if (
      typeof service.image !== "string" ||
      service.image.includes("__") ||
      service.image.endsWith(":latest")
    )
      throw new Error("Unpinned or unresolved production image");
  }
  if (!replacements)
    throw new Error("Template has no release image placeholders");
  return doc;
}

/** Calls only the configured deployment MCP; credentials travel through curl stdin and never logs/argv. */
async function deploy() {
  const doc = prepareDeployment(
    process.env.DOKPLOY_COMPOSE_JSON ?? "",
    process.env.BACKEND_IMAGE ?? "",
    process.env.GATEWAY_IMAGE ?? "",
  );
  const endpoint = new URL(process.env.DOKPLOY_MCP_URL ?? "");
  if (endpoint.protocol !== "https:")
    throw new Error("Deployment MCP requires HTTPS");
  const auth = JSON.parse(process.env.DOKPLOY_MCP_HEADERS ?? "{}");
  if (
    !Object.keys(auth).length ||
    Object.entries(auth).some(
      ([k, v]) =>
        !/^[\w-]+$/.test(k) || typeof v !== "string" || /[\r\n]/.test(v),
    )
  )
    throw new Error("Invalid deployment authentication headers");
  const composeId = process.env.DOKPLOY_COMPOSE_ID;
  if (!composeId) throw new Error("Deployment identity is required");
  const temp = mkdtempSync(join(tmpdir(), "starter-deploy-"));
  let session = "";
  async function rpc(method: string, params: unknown) {
    const headerFile = join(temp, "headers");
    const headers = {
      ...auth,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    };
    const config = [
      `url = ${JSON.stringify(endpoint.href)}`,
      'request = "POST"',
      ...Object.entries(headers).map(
        ([k, v]) => `header = ${JSON.stringify(k + ": " + v)}`,
      ),
      `data = ${JSON.stringify(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }))}`,
    ].join("\n");
    const result = spawnSync(
      "curl",
      ["-sS", "--max-time", "90", "--config", "-", "-D", headerFile],
      { input: config, encoding: "utf8", maxBuffer: 5_000_000 },
    );
    if (result.status !== 0) throw new Error("Deployment transport failed");
    const nextSession = readFileSync(headerFile, "utf8").match(
      /^mcp-session-id:\s*(.+)$/im,
    );
    if (nextSession) session = nextSession[1].trim();
    const raw = /^(event:|data:)/.test(result.stdout)
      ? result.stdout
          .split("\n")
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice(6))
          .join("\n")
      : result.stdout;
    const response = JSON.parse(raw);
    if (response.error) throw new Error("Deployment RPC rejected");
    return response.result;
  }
  async function call(name: string, args: unknown) {
    const result = await rpc("tools/call", { name, arguments: args });
    const item = result?.content?.find((x: any) => x.type === "text");
    const parsed = JSON.parse(item?.text ?? "{}");
    if (result?.isError || parsed.success === false)
      throw new Error("Deployment operation failed: " + name);
    return parsed.data ?? parsed;
  }
  try {
    await rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "starter-release", version: "1" },
    });
    const before = await call("deployment-allByCompose", { composeId });
    const priorIds = new Set(
      (Array.isArray(before) ? before : []).map((d: any) => d.deploymentId),
    );
    // Deliberately update only the compose template. Preserve the existing environment/secrets.
    await call("compose-update", {
      composeId,
      composeFile: JSON.stringify(doc, null, 2),
    });
    await call("compose-deploy", {
      composeId,
      title: "Deploy verified registry images",
      description:
        "GitHub runner build and offline embedding verification passed. Preserve all persistent state.",
      freshVolumes: false,
    });
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
      const rows = await call("deployment-allByCompose", { composeId });
      const current = (Array.isArray(rows) ? rows : []).find(
        (d: any) => !priorIds.has(d.deploymentId),
      );
      if (current?.status === "error")
        throw new Error(
          "Dokploy deployment failed; inspect protected deployment logs",
        );
      if (current?.status === "done") {
        console.log(
          "Dokploy deployment finished. Live application acceptance remains a separate verification.",
        );
        return;
      }
    }
    throw new Error(
      "Dokploy deployment did not finish within the verification window",
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  deploy().catch(() => {
    console.error(
      "Release deployment failed. No credentials were logged; inspect the protected deployment status.",
    );
    process.exitCode = 1;
  });
}
