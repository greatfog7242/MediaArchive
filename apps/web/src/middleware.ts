import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/api/hono"];
const ADMIN_PATHS = ["/admin"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/record/new") {
    return NextResponse.redirect(new URL("/record/create", req.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env["AUTH_SECRET"],
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const isAdminPath = ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isAdminPath && token["role"] !== "ADMIN") {
    return NextResponse.json(
      { error: "Forbidden - admin access required" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
