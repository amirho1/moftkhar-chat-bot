import stateKey from "./state-key.ts";
import getRedisClient from "./redis.ts";
import { randomUUID } from "node:crypto";

const reserve = `
for i = 1, 3 do
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', ARGV[4])
if redis.call('ZCARD', KEYS[4]) >= tonumber(ARGV[5]) then return 0 end
for i = 1, 3 do
  if redis.call('INCR', KEYS[i]) == 1 then redis.call('EXPIRE', KEYS[i], ARGV[6]) end
end
redis.call('ZADD', KEYS[4], ARGV[7], ARGV[8])
redis.call('EXPIRE', KEYS[4], 120)
return 1
`;

/** Atomically enforces shared hourly limits and leases concurrent requests. */
export default async function reserveChat(session: string, network: string) {
  const redis = await getRedisClient();
  const lease = randomUUID();
  const now = Date.now();
  const limit = (name: string, fallback: number) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error("invalid_chat_limit");
    return String(value);
  };
  const result = await redis.eval(reserve, {
    keys: [
      stateKey(`session:${session}`),
      stateKey(`network:${network}`),
      stateKey("global"),
      stateKey("active"),
    ],
    arguments: [
      limit("CHAT_SESSION_LIMIT", 20),
      limit("CHAT_IP_LIMIT", 40),
      limit("CHAT_GLOBAL_LIMIT", 200),
      String(now - 90_000),
      limit("CHAT_CONCURRENCY", 3),
      "3600",
      String(now),
      lease,
    ],
  });
  if (Number(result) !== 1) return null;
  return () => redis.zRem(stateKey("active"), lease);
}
