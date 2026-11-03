// One-time setup for the authenticator code.
// Creates TOTP_SECRET in .env.local (if missing) and opens a QR code to scan
// with an authenticator app. The secret is never printed.
// Run: node scripts/setup-2fa.mjs        (add --new to replace an existing secret)

import { randomBytes } from "crypto";
import { exec } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import QRCode from "qrcode";

const ENV = path.join(process.cwd(), ".env.local");
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32(bytes) {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

let env = await fs.readFile(ENV, "utf8");
let secret = env.match(/^TOTP_SECRET=(.+)$/m)?.[1].trim();

if (!secret || process.argv.includes("--new")) {
  secret = base32(randomBytes(20));
  env = /^TOTP_SECRET=.*$/m.test(env)
    ? env.replace(/^TOTP_SECRET=.*$/m, `TOTP_SECRET=${secret}`)
    : `${env.trimEnd()}\nTOTP_SECRET=${secret}\n`;
  await fs.writeFile(ENV, env);
  console.log("Saved a new TOTP_SECRET in .env.local.");
}

const url = `otpauth://totp/Finance%20Hub?secret=${secret}&issuer=Finance%20Hub&algorithm=SHA1&digits=6&period=30`;
const file = path.join(os.tmpdir(), "finance-hub-2fa.png");
await QRCode.toFile(file, url, { width: 360, margin: 2 });

const open = process.platform === "win32" ? `start "" "${file}"` : process.platform === "darwin" ? `open "${file}"` : `xdg-open "${file}"`;
exec(open);
console.log("Opened the QR code. Scan it with your authenticator app, then close it.");
console.log(`Delete it afterwards: ${file}`);
