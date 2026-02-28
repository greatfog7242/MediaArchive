import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Public paths that bypass authentication entirely.
 * Everything else requires a valid JWT.
 */
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/api/hono"];

/** Admin-only route prefixes (coarse-grained, fine-grained is in Hono). */
const ADMIN_PATHS = ["/admin"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes through without auth
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Decode JWT — next-auth stores it in the `authjs.session-token` cookie
  const token = await getToken({
    req,
    secret: process.env["AUTH_SECRET"],
  });

  // No valid token → redirect to login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Coarse-grained admin route check
  const isAdminPath = ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isAdminPath && token["role"] !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static assets and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
