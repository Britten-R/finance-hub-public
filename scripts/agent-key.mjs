// Makes or kills the secret key for the Claude connector (read-only finance tools).
//   node scripts/agent-key.mjs new      -> new key (the old one stops working); opens the
//                                          connector link in a text file to copy into claude.ai
//   node scripts/agent-key.mjs revoke   -> kills the key; the connector stops working
// Only the key's SHA-256 fingerprint is saved (in Redis). The key itself is never printed.

import { createHash, randomBytes } from "crypto";
import { exec } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const HASH_KEY = "agent:key-sha256";

const env = Object.fromEntries(
  (await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8"))
    .split(/\r?\n/)
    .filter((l) => /^\w+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
// Your deployed address, e.g. https://<your-project>.vercel.app (SITE_URL in .env.local).
const SITE = (env.SITE_URL || "").replace(/\/$/, "");
if (!SITE) throw new Error("Set SITE_URL in .env.local to your deployed address.");
const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN must be in .env.local.");

async function redis(command) {
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(command) });
  if (!res.ok) throw new Error(`Redis said ${res.status}.`);
  return (await res.json()).result;
}

const action = process.argv[2];
if (action === "revoke") {
  await redis(["DEL", HASH_KEY]);
  console.log("Key killed. The Claude connector no longer works.");
} else if (action === "new") {
  const key = randomBytes(32).toString("base64url");
  await redis(["SET", HASH_KEY, createHash("sha256").update(key).digest("hex")]);
  const file = path.join(os.tmpdir(), "finance-hub-connector.txt");
  await fs.writeFile(
    file,
    `Paste this into claude.ai -> Settings -> Connectors -> Add custom connector -> URL:\n\n${SITE}/api/mcp/${key}\n\nThen delete this file.\n`,
  );
  exec(process.platform === "win32" ? `notepad "${file}"` : `open "${file}"`);
  console.log("New key saved (any old key stopped working). Opened the connector link in a text file.");
  console.log(`Delete it after copying: ${file}`);
} else {
  console.log("Use: node scripts/agent-key.mjs new | revoke");
}
