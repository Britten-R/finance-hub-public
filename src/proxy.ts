import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Runs before every request. Everything except the login page needs a valid
// session cookie: pages redirect to /login, API calls get a 401.
// The Claude connector (/api/mcp/<key>) checks its own secret key instead.
export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/mcp/")) return NextResponse.next();
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  login.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip only Next's own build files and the browser tab icon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
