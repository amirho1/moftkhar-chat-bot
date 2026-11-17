import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Best-effort local scan with redacted findings. Never prints matched values. */
export function scanText(text: string) {
  const findings: { line: number; rule: string }[] = [];
  const rules: [string, RegExp][] = [
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["provider-token", /\bsk-[A-Za-z0-9_-]{24,}\b/],
    [
      "github-token",
      /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
    ],
    ["credential-url", /https?:\/\/[^\s/@:]+:[^\s/@]+@/],
    [
      "literal-secret-setting",
      /^\s*(?:API_KEY|OPENAI_API_KEY|JWT_SECRET_KEY|ENCRYPTION_SECRET_KEY|INTERNAL_KEY|CHAT_SESSION_SECRET|DOCSGPT_MANAGEMENT_TOKEN|POSTGRES_PASSWORD)\s*=\s*[A-Za-z0-9_+/.=-]{24,}\s*$/,
    ],
  ];
  for (const [index, line] of text.split("\n").entries())
    for (const [rule, pattern] of rules)
      if (pattern.test(line)) findings.push({ line: index + 1, rule });
  for (const term of (process.env.PRIVATE_SCAN_TERMS ?? "")
    .split(",")
    .filter(Boolean)) {
    for (const [index, line] of text.split("\n").entries())
      if (line.toLowerCase().includes(term.toLowerCase()))
        findings.push({ line: index + 1, rule: "private-marker" });
  }
  return findings;
}

if (process.argv[1]?.endsWith("scan.ts")) {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error("Cannot enumerate shareable files");
  let failed = false;
  let files = 0;
  for (const path of [...new Set(result.stdout.split("\0").filter(Boolean))]) {
    if (/\.(png|jpg|webp|woff2?|ico)$/i.test(path)) continue;
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    files += 1;
    // The scanner's own redaction rules and test fixtures are intentional signatures.
    if (path === "scripts/scan.ts" || path === "tests/scanner.test.ts")
      continue;
    for (const finding of scanText(text)) {
      failed = true;
      console.log(`${path}:${finding.line} ${finding.rule} [VALUE REDACTED]`);
    }
    if (
      /^(?:\.env(?!\.example)|\.private\/|\.runtime\/|(?:exports|backups|transcripts|customer-data)\/)/.test(
        path,
      )
    ) {
      failed = true;
      console.log(`${path}: forbidden shareable path`);
    }
  }
  const history = spawnSync(
    "git",
    [
      "log",
      "--all",
      "--format=commit %H",
      "-p",
      "--",
      ".",
      ":!package-lock.json",
      ":!scripts/scan.ts",
      ":!tests/scanner.test.ts",
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (history.status === 0) {
    const historical = scanText(history.stdout);
    if (historical.length) {
      failed = true;
      console.log(
        `Git history: ${historical.length} potential secret signatures; values withheld, review privately`,
      );
    }
  }
  const revisions = spawnSync("git", ["rev-list", "--all", "--count"], {
    encoding: "utf8",
  });
  console.log(
    JSON.stringify({
      filesScanned: files,
      reachableCommits: Number(revisions.stdout.trim()) || 0,
      status: failed ? "review_required" : "no_signatures_found",
      limitations:
        "Pattern-based text scan; excludes ignored/private files and binary data. Does not prove absence of secrets, inspect remote-only/unreachable objects, releases or third-party copies.",
    }),
  );
  process.exitCode = failed ? 1 : 0;
}
