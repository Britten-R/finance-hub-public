import { Redis } from "@upstash/redis";

// Login bookkeeping kept in Upstash Redis (shared by the laptop and the site):
// - "epoch": bumped by "Sign out all devices"; older cookies stop working.
// - failed-try counters per IP, for the lockout.
// - used authenticator codes, so a code can't be replayed.
// Without Redis (rare), it falls back to memory in this one server.

const hasRedis = () => Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
const memory = new Map<string, { value: number; expires: number }>();

export const MAX_TRIES = 5;
export const LOCK_MINUTES = 15;

const EPOCH_KEY = "auth:epoch";
let epochCache: { value: number; at: number } | null = null;

// Checked on every page load, so cached for 30 seconds per server.
export async function getEpoch(): Promise<number> {
  if (epochCache && Date.now() - epochCache.at < 30_000) return epochCache.value;
  const value = hasRedis() ? Number((await Redis.fromEnv().get<number>(EPOCH_KEY)) ?? 0) : (memory.get(EPOCH_KEY)?.value ?? 0);
  epochCache = { value, at: Date.now() };
  return value;
}

export async function bumpEpoch(): Promise<number> {
  const value = hasRedis() ? await Redis.fromEnv().incr(EPOCH_KEY) : (memory.get(EPOCH_KEY)?.value ?? 0) + 1;
  if (!hasRedis()) memory.set(EPOCH_KEY, { value, expires: Infinity });
  epochCache = { value, at: Date.now() };
  return value;
}

const failKey = (ip: string) => `auth:fail:${ip}`;

export async function isLockedOut(ip: string): Promise<boolean> {
  if (hasRedis()) return Number((await Redis.fromEnv().get<number>(failKey(ip))) ?? 0) >= MAX_TRIES;
  const entry = memory.get(failKey(ip));
  return Boolean(entry && entry.expires > Date.now() && entry.value >= MAX_TRIES);
}

export async function recordFailure(ip: string): Promise<void> {
  const key = failKey(ip);
  if (hasRedis()) {
    const redis = Redis.fromEnv();
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, LOCK_MINUTES * 60);
    return;
  }
  const entry = memory.get(key);
  const fresh = !entry || entry.expires < Date.now();
  memory.set(key, {
    value: fresh ? 1 : entry.value + 1,
    expires: fresh ? Date.now() + LOCK_MINUTES * 60_000 : entry.expires,
  });
}

export async function clearFailures(ip: string): Promise<void> {
  if (hasRedis()) await Redis.fromEnv().del(failKey(ip));
  else memory.delete(failKey(ip));
}

// True the first time a code's time step is used; false if it was already used.
export async function claimCodeStep(step: number): Promise<boolean> {
  const key = `auth:totp:${step}`;
  if (hasRedis()) return (await Redis.fromEnv().set(key, 1, { nx: true, ex: 120 })) === "OK";
  if (memory.has(key)) return false;
  memory.set(key, { value: 1, expires: Date.now() + 120_000 });
  return true;
}
