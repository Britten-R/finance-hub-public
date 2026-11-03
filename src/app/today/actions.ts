"use server";

import { setDone } from "@/lib/agenda";
import { isSignedIn } from "@/lib/auth";

export async function toggleItem(id: string, done: boolean) {
  if (!(await isSignedIn())) throw new Error("Not signed in.");
  if (typeof id !== "string" || id.length > 200) throw new Error("Bad item.");
  await setDone(id, done);
}
