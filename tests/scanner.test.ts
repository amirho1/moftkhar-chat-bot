import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText } from "../scripts/scan.ts";

test("scanner reports categories and locations without returning credential values", () => {
  const key = "sk-" + "a".repeat(32);
  const result = scanText(`API_KEY=${key}\n-----BEGIN PRIVATE KEY-----`);
  assert.deepEqual(
    new Set(result.map((finding) => finding.rule)),
    new Set(["provider-token", "literal-secret-setting", "private-key"]),
  );
  assert.deepEqual(result[0], { line: 1, rule: "provider-token" });
  assert(!JSON.stringify(result).includes(key));
});
