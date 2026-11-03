// Signed cookies. The value is `<kind>.<epoch>.<expiry>.<signature>`; only the
// server knows AUTH_SECRET, so nobody can forge or extend one.
// - session: "you're signed in" (password + code checked).
// - device: "this browser already passed the authenticator code", so next
//   time only the password is needed.
// "Sign out all devices" bumps the epoch, which voids every older cookie.
// Uses Web Crypto so it works in both proxy.ts and server code.

import { getEpoch } from "./auth-store";

export const SESSION_COOKIE = "session";
export const DEVICE_COOKIE = "device";
export const SESSION_DAYS = 14;
export const DEVICE_DAYS = 90;

type Kind = "session" | "device";
const DAYS: Record<Kind, number> = { session: SESSION_DAYS, device: DEVICE_DAYS };

const enc = new TextEncoder();

async function sign(message: string): Promise<string> {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET in .env.local must be at least 32 characters.");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Buffer.from(sig).toString("base64url");
}

// Compares without leaking how many characters matched.
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export async function createToken(kind: Kind): Promise<{ value: string; expires: Date }> {
  const expires = new Date(Date.now() + DAYS[kind] * 86400000);
  const payload = `${kind}.${await getEpoch()}.${expires.getTime()}`;
  return { value: `${payload}.${await sign(payload)}`, expires };
}

export async function verifyToken(kind: Kind, value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [k, epoch, expiry, sig] = value.split(".");
  if (k !== kind || !sig || Number(expiry) < Date.now()) return false;
  try {
    if (Number(epoch) !== (await getEpoch())) return false;
    return safeEqual(sig, await sign(`${k}.${epoch}.${expiry}`));
  } catch {
    return false;
  }
}

export const verifySession = (value: string | undefined) => verifyToken("session", value);
