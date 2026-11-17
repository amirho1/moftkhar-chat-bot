import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const https = z.url().refine((value) => new URL(value).protocol === "https:");
export const starterSchema = z
  .object({
    organization: z.object({
      name: z.string().min(1),
      website: https,
      supportUrl: https,
    }),
    ui: z.object({
      locale: z.string(),
      theme: z.enum(["light", "dark"]),
      color: z.string().regex(/^#[a-f0-9]{6}$/i),
      title: z.string(),
      greeting: z.string(),
      privacyHint: z.string(),
      questions: z.array(z.string()).max(4),
    }),
    knowledge: z.object({
      name: z.string(),
      mode: z.enum(["file", "website"]),
      file: z.string().optional(),
      websiteConfig: z.string().optional(),
      syncSeconds: z.number().int().min(300),
    }),
    agent: z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      contextTokens: z.number().int().min(16000),
      historyTokens: z.number().int().min(4000),
      tokenQuota: z.number().int().positive(),
      requestQuota: z.number().int().positive(),
    }),
    links: z.object({
      allowedHosts: z.array(z.string()),
      allowedPaths: z.array(z.string().startsWith("/")),
    }),
  })
  .strict();

/** Read a public configuration file; no credentials belong here. */
export function loadConfig(
  path = process.env.STARTER_CONFIG ?? "config/starter.json",
) {
  return starterSchema.parse(JSON.parse(readFileSync(resolve(path), "utf8")));
}

/** Decode simple dotenv values without executing shell code or interpolation. */
export function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

/** Load only local configuration; environment values already supplied take precedence. */
export function loadLocalEnv(path = process.env.STARTER_ENV_FILE ?? ".env") {
  try {
    for (const [key, value] of Object.entries(
      parseEnv(readFileSync(path, "utf8")),
    ))
      process.env[key] ??= value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
