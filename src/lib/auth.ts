import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session";

// Second lock for API routes, in case proxy.ts is ever bypassed.
export async function isSignedIn(): Promise<boolean> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
