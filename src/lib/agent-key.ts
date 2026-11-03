import "server-only";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { safeEqual } from "./session";

// The secret key in the Claude connector link (/api/mcp/<key>). Redis keeps
// only its SHA-256 fingerprint, so the database alone can't rebuild the link.
// Make or kill the key with: node scripts/agent-key.mjs new | revoke

export const AGENT_KEY_HASH = "agent:key-sha256";

export async function agentKeyValid(key: string): Promise<boolean> {
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) return false;
  const stored = await Redis.fromEnv().get<string>(AGENT_KEY_HASH);
  if (!stored || key.length < 32) return false;
  return safeEqual(createHash("sha256").update(key).digest("hex"), stored);
}
