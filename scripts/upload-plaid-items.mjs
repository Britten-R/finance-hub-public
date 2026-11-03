// One-time copy of the laptop's Plaid connections (.data/plaid-items.json)
// into Upstash Redis, encrypted the same way as src/lib/plaid.ts.
// Run: node --env-file=.env.local scripts/upload-plaid-items.mjs
import { Redis } from "@upstash/redis";
import { createCipheriv, randomBytes } from "crypto";
import { readFileSync } from "fs";

const items = JSON.parse(readFileSync(".data/plaid-items.json", "utf8"));
const key = Buffer.from(process.env.TOKEN_KEY?.trim() ?? "", "base64url");
if (key.length !== 32) throw new Error("TOKEN_KEY must be 32 random bytes (base64url).");

const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const data = Buffer.concat([cipher.update(JSON.stringify(items), "utf8"), cipher.final()]);
await Redis.fromEnv().set("plaid-items", [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join("."));
console.log(`Uploaded ${items.length} connections: ${items.map((i) => i.institution).join(", ")}`);
