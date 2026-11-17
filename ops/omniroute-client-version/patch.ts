import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Optional operational compatibility layer; never used by the starter installation.
// Keep the deployed router version and all routing/authentication behavior unchanged.
export function patchBundle(source: string, ide: string, cli: string): string {
  if (![ide, cli].every((v) => /^\d+\.\d+\.\d+$/.test(v)))
    throw Error("Explicit numeric client versions are required");
  const needle = 'let d="2.1.1",e="1.1.5",f={cache:null,inFlight:null}';
  if (
    !source.includes("OmniRoute-AntigravityVersion/1.0") ||
    source.split(needle).length !== 2
  )
    throw Error("Unexpected router bundle; refusing an unreviewed patch");
  return source.replace(
    needle,
    `let d="${ide}",e="${cli}",f={cache:null,inFlight:null}`,
  );
}

export function patchImage(root: string, ide: string, cli: string): void {
  const targets = [
    ".build/next/server/chunks/73873.js",
    ".build/next/server/chunks/73716.js",
    ".build/next/server/middleware.js",
  ];
  // Validate every file before changing any file. No data, environment or account reads.
  const changed = targets.map((path) => {
    const file = join(root, path);
    return { file, source: patchBundle(readFileSync(file, "utf8"), ide, cli) };
  });
  for (const { file, source } of changed) writeFileSync(file, source);
  console.log(JSON.stringify({ patchedBundles: changed.length, ide, cli }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  patchImage(
    process.argv[2] ?? "/app",
    process.argv[3] ?? "",
    process.argv[4] ?? "",
  );
