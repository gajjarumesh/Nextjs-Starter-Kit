import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/sign-in", "/sign-up"];
const PROTECTED_PREFIXES = ["/onboarding", "/account", "/admin"];

function newRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `req_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Runs before every matched request:
 *  - gives every request a requestId (logs and error responses carry it);
 *  - optimistic redirect for signed-out users on protected pages. This only checks that a
 *    session cookie exists; the real checks happen on the server (requireUser / requireOrgAccess).
 */
export function proxy(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? newRequestId();
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);

  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(getSessionCookie(req));

  if (
    !hasSession &&
    PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (hasSession && AUTH_PAGES.includes(pathname) && !req.nextUrl.searchParams.has("next")) {
    // Signed-in users land on their workspace instead of the auth forms.
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|svg|webp|ico)$).*)",
  ],
};
