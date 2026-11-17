import { createClient } from "redis";
let pending: Promise<ReturnType<typeof createClient>> | undefined;

/** One lazy shared connection; unavailable rate-limit state fails closed. */
export default function getRedisClient() {
  pending ??= (async () => {
    const client = createClient({
      url: process.env.REDIS_URL,
      socket: { connectTimeout: 5000, reconnectStrategy: false },
    });
    client.on("error", () => {
      pending = undefined;
      console.error(JSON.stringify({ event: "redis_unavailable" }));
    });
    await client.connect();
    return client;
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
