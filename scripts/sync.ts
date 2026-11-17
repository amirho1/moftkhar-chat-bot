import { createClient } from "redis";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { loadConfig, loadLocalEnv } from "../src/lib/config.ts";
import { DocsGPTClient } from "./docsgpt-client.ts";

loadLocalEnv();
const config = loadConfig();
if (config.knowledge.mode !== "website") {
  console.log(
    "File knowledge does not crawl or sync remotely. Review file updates and reingest through DocsGPT.",
  );
} else {
  const cache = createClient({ url: process.env.CACHE_REDIS_URL });
  cache.on("error", () => console.error('{"event":"sync_redis_unavailable"}'));
  await cache.connect();
  const client = new DocsGPTClient(
    process.env.DOCSGPT_MANAGEMENT_URL ?? "http://127.0.0.1:7091",
    process.env.DOCSGPT_MANAGEMENT_TOKEN ?? "",
  );
  while (true) {
    const lease = randomUUID();
    if (await cache.set("starter:sync:lock", lease, { NX: true, EX: 1500 })) {
      try {
        const sources = await client.request("GET", "/api/sources");
        const source = sources.find(
          (source: any) =>
            source.name === config.knowledge.name &&
            source.ownership === "user",
        );
        if (!source) throw new Error("source_not_provisioned");
        const job = await client.request("POST", "/api/sync_source", {
          source_id: source.id,
        });
        await client.wait(job.task_id);
        await cache.hSet("starter:sync:status", {
          state: "success",
          lastSuccess: new Date().toISOString(),
          lastError: "",
        });
      } catch (error) {
        await cache.hSet("starter:sync:status", {
          state: "failed",
          lastFailure: new Date().toISOString(),
          lastError: (error as Error).name,
        });
      } finally {
        await cache.eval(
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
          { keys: ["starter:sync:lock"], arguments: [lease] },
        );
      }
    }
    await delay(config.knowledge.syncSeconds * 1000);
  }
}
