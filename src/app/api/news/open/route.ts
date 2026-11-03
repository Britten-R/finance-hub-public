import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/auth";
import { recordOpen } from "@/lib/general-news";

// Counts which topic you opened (for tomorrow's ranking), then goes to the article.
// Only redirects to a URL from that day's stored list, never one from the query.
export async function GET(request: Request) {
  if (!(await isSignedIn())) return Response.json({ error: "Not signed in." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const url = await recordOpen(params.get("d") ?? "", params.get("id") ?? "");
  if (!url) return Response.json({ error: "Story not found." }, { status: 404 });
  redirect(url);
}
