import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic cookie-presence check only — Next.js 14 middleware runs on the Edge runtime,
// which can't do a real DB-backed session check. Real verification happens per-page
// (app/page.tsx) and per-route (lib/authz.ts's requireSession()), matching the previous
// NextAuth middleware, which was also just a JWT-presence check at this layer.
export function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === "/login";
  const hasSessionCookie = !!getSessionCookie(request);

  if (isLoginPage) {
    if (hasSessionCookie) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
