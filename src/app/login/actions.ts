"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { bumpEpoch, claimCodeStep, clearFailures, isLockedOut, LOCK_MINUTES, recordFailure } from "@/lib/auth-store";
import { createToken, DEVICE_COOKIE, safeEqual, SESSION_COOKIE, verifyToken } from "@/lib/session";
import { checkTotp } from "@/lib/totp";

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

// Vercel puts the visitor's real IP first in x-forwarded-for.
async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const expected = process.env.DASHBOARD_PASSWORD?.trim();
  const totpSecret = process.env.TOTP_SECRET?.trim();
  if (!expected) return "DASHBOARD_PASSWORD isn't set yet.";
  if (!totpSecret) return "TOTP_SECRET isn't set yet.";

  const ip = await clientIp();
  if (await isLockedOut(ip)) return `Too many wrong tries. Wait ${LOCK_MINUTES} minutes.`;

  const jar = await cookies();
  const trustedDevice = await verifyToken("device", jar.get(DEVICE_COOKIE)?.value);

  const passwordOk = safeEqual(String(form.get("password") ?? ""), expected);
  let codeOk = trustedDevice;
  if (!trustedDevice) {
    const step = await checkTotp(String(form.get("code") ?? ""), totpSecret);
    codeOk = step !== null && (await claimCodeStep(step));
  }

  if (!passwordOk || !codeOk) {
    await recordFailure(ip);
    await new Promise((r) => setTimeout(r, 1000)); // slows down guessing
    // Same message either way, so a guesser can't tell which part was wrong.
    return trustedDevice ? "Wrong password." : "Wrong password or code.";
  }

  await clearFailures(ip);
  const session = await createToken("session");
  jar.set(SESSION_COOKIE, session.value, cookieOptions(session.expires));
  if (!trustedDevice) {
    const device = await createToken("device");
    jar.set(DEVICE_COOKIE, device.value, cookieOptions(device.expires));
  }

  // Only follow local paths, so a crafted link can't bounce you to another site.
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// Voids every session and remembered device, everywhere (lost phone, etc.).
export async function logoutEverywhere() {
  const jar = await cookies();
  // Server actions can be called from /login too, so check here as well.
  if (!(await verifyToken("session", jar.get(SESSION_COOKIE)?.value))) redirect("/login");
  await bumpEpoch();
  jar.delete(SESSION_COOKIE);
  jar.delete(DEVICE_COOKIE);
  redirect("/login");
}
