import "server-only";
import { Redis } from "@upstash/redis";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Plaid access tokens are secrets. They live only on the server: a gitignored
// local file on the laptop, or an encrypted value in Redis when online.

export type PlaidItem = {
  itemId: string;
  accessToken: string;
  institution: string;
  kind: "bank" | "investments";
  linkedAt: string;
};

const STORE = path.join(process.cwd(), ".data", "plaid-items.json");

export const plaidConfigured = () => Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);

export function plaidClient() {
  const env = (process.env.PLAID_ENV?.trim() || "sandbox") as keyof typeof PlaidEnvironments;
  if (!(env in PlaidEnvironments)) {
    // Don't echo the value: a mis-pasted secret could end up here.
    throw new Error('PLAID_ENV in .env.local must be "sandbox" or "production".');
  }
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
          "PLAID-SECRET": process.env.PLAID_SECRET!,
        },
      },
    }),
  );
}

// Online (Vercel), tokens live in Upstash Redis, encrypted with TOKEN_KEY so the
// database alone is useless. On the laptop without Redis, the local file is used.
const REDIS_KEY = "plaid-items";
const hasRedis = () => Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);

function tokenKey(): Buffer {
  const key = Buffer.from(process.env.TOKEN_KEY?.trim() ?? "", "base64url");
  if (key.length !== 32) throw new Error("TOKEN_KEY must be 32 random bytes (base64url).");
  return key;
}

export function encryptItems(items: PlaidItem[]): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(items), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

function decryptItems(blob: string): PlaidItem[] {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")) as PlaidItem[];
}

export async function readItems(): Promise<PlaidItem[]> {
  if (hasRedis()) {
    const blob = await Redis.fromEnv().get<string>(REDIS_KEY);
    return blob ? decryptItems(blob) : [];
  }
  try {
    return JSON.parse(await fs.readFile(STORE, "utf8")) as PlaidItem[];
  } catch {
    return [];
  }
}

export async function saveItem(item: PlaidItem) {
  const items = [...(await readItems()).filter((i) => i.itemId !== item.itemId), item];
  if (hasRedis()) {
    await Redis.fromEnv().set(REDIS_KEY, encryptItems(items));
    return;
  }
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  await fs.writeFile(STORE, JSON.stringify(items, null, 2));
}

// Plaid error bodies explain what went wrong (e.g. INVALID_API_KEYS).
export function plaidErrorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error_code?: string; error_message?: string } } }).response?.data;
  return data?.error_code ? `${data.error_code}: ${data.error_message}` : err instanceof Error ? err.message : "Unknown Plaid error";
}
