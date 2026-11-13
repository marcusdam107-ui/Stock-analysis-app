import { NextResponse, type NextRequest } from "next/server";

// The app is a personal desk served on this machine only. Refusing other Host headers blocks
// DNS-rebinding pages from reaching the local API (and any paid keys behind it).
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "").toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) return new NextResponse("Forbidden", { status: 403 });

  // API routes are only for this app's own pages: reject cross-site browser requests.
  if (req.nextUrl.pathname.startsWith("/api/") && req.headers.get("sec-fetch-site") === "cross-site") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
