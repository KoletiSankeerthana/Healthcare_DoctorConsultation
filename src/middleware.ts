import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Bypass public assets, API routes, and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("mediverse_session")?.value;
  const userRole = request.cookies.get("mediverse_role")?.value?.toLowerCase();

  const fullDestination = pathname + (search || "");

  const buildLoginRedirect = (requiredRole?: string) => {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", fullDestination);
    if (requiredRole) {
      loginUrl.searchParams.set("role", requiredRole);
    }
    return NextResponse.redirect(loginUrl);
  };

  // 1. Admin Protected Routes (/admin/*)
  if (pathname.startsWith("/admin")) {
    if (!sessionToken) {
      return buildLoginRedirect("admin");
    }
    if (userRole && userRole !== "admin") {
      const redirectUrl = new URL(
        userRole === "doctor" ? "/doctor/dashboard" : "/patient/dashboard",
        request.url
      );
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 2. Doctor Workspace Protected Routes (/doctor/dashboard/*, /doctor/*)
  if (pathname.startsWith("/doctor/dashboard") || pathname === "/doctor" || pathname.startsWith("/doctor/")) {
    if (!sessionToken) {
      return buildLoginRedirect("doctor");
    }
    if (userRole && userRole !== "doctor" && userRole !== "admin") {
      const redirectUrl = new URL("/patient/dashboard", request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 3. Patient Protected Routes (/patient/*)
  if (pathname.startsWith("/patient")) {
    if (!sessionToken) {
      return buildLoginRedirect("patient");
    }
    if (userRole && userRole === "doctor") {
      const redirectUrl = new URL("/doctor/dashboard", request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 4. Clinical Features Protected Routes (/ai-assistant, /checkout, /consultation, /payment)
  if (
    pathname === "/ai-assistant" ||
    pathname.startsWith("/ai-assistant/") ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/") ||
    pathname === "/consultation" ||
    pathname.startsWith("/consultation/") ||
    pathname.startsWith("/payment/")
  ) {
    if (!sessionToken) {
      return buildLoginRedirect("patient");
    }
  }

  // 5. Redirect already authenticated users away from /login and /register
  if ((pathname === "/login" || pathname === "/register") && sessionToken && userRole) {
    // If a redirect param is explicitly present, follow it
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    if (redirectParam && !redirectParam.startsWith("/login") && !redirectParam.startsWith("/register")) {
      return NextResponse.redirect(new URL(redirectParam, request.url));
    }

    if (userRole === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    if (userRole === "doctor") {
      return NextResponse.redirect(new URL("/doctor/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/patient/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/doctor/:path*",
    "/doctor",
    "/patient/:path*",
    "/patient",
    "/ai-assistant/:path*",
    "/ai-assistant",
    "/checkout/:path*",
    "/checkout",
    "/consultation/:path*",
    "/consultation",
    "/payment/:path*",
    "/login",
    "/register"
  ]
};
