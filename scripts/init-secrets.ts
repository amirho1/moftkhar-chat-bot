import { createHmac, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "../src/lib/config.ts";

/** Initialize missing secrets once while preserving comments and unrelated settings. */
export function initializeSecrets(path: string, example = ".env.example") {
  if (!existsSync(path))
    writeFileSync(path, readFileSync(example), { mode: 0o600, flag: "wx" });
  chmodSync(path, 0o600);
  let text = readFileSync(path, "utf8");
  const values = parseEnv(text);
  const generated: string[] = [];
  const set = (key: string, value: string) => {
    values[key] = value;
    const line = `${key}=${value}`;
    text = text.match(new RegExp(`^${key}=`, "m"))
      ? text.replace(new RegExp(`^${key}=.*$`, "m"), line)
      : `${text.trimEnd()}\n${line}\n`;
    generated.push(key);
  };
  for (const key of [
    "POSTGRES_PASSWORD",
    "JWT_SECRET_KEY",
    "ENCRYPTION_SECRET_KEY",
    "INTERNAL_KEY",
    "CHAT_SESSION_SECRET",
  ]) {
    if (!values[key]) set(key, randomBytes(32).toString("hex"));
  }
  if (!values.DOCSGPT_MANAGEMENT_TOKEN) {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: values.DOCSGPT_USER || "starter-operator" })}`;
    set(
      "DOCSGPT_MANAGEMENT_TOKEN",
      `${body}.${createHmac("sha256", values.JWT_SECRET_KEY).update(body).digest("base64url")}`,
    );
  }
  if (values.POSTGRES_URI?.includes("REPLACE_WITH_GENERATED_PASSWORD"))
    set(
      "POSTGRES_URI",
      values.POSTGRES_URI.replace(
        "REPLACE_WITH_GENERATED_PASSWORD",
        encodeURIComponent(values.POSTGRES_PASSWORD),
      ),
    );
  writeFileSync(path, text, { mode: 0o600 });
  return { generated, values };
}
