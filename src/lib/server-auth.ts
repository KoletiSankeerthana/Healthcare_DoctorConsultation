import { NextRequest, NextResponse } from "next/server";
import { callDbBridge } from "@/lib/dbBridge";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  patient_id?: string;
  doctor_id?: string;
  session_id?: string;
  expires_at?: string;
}

// In-memory session cache (60s TTL) for high throughput
const sessionCache = new Map<string, { user: AuthUser; expiresAt: number }>();

export function invalidateSession(sessionToken: string) {
  sessionCache.delete(sessionToken);
}

/**
 * Extracts and strictly validates the session token from cookies or Authorization header.
 * Returns the authenticated user or null if unauthenticated or expired.
 * NEVER returns a hardcoded or dummy user.
 */
export function getAuthenticatedUser(request: NextRequest): AuthUser | null {
  try {
    let sessionToken = request.cookies.get("mediverse_session")?.value;
    if (!sessionToken) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.substring(7).trim();
      }
    }

    if (!sessionToken) {
      return null;
    }

    // 1. Check in-memory cache
    const cached = sessionCache.get(sessionToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.user;
    }

    // 2. Validate session via dbBridge (which queries UserSession table for active, non-revoked session)
    const res = callDbBridge<{ authenticated: boolean; user: AuthUser }>("auth_me", [sessionToken]);
    if (res && res.authenticated && res.user && res.user.id) {
      sessionCache.set(sessionToken, {
        user: res.user,
        expiresAt: Date.now() + 60000 // 60-second TTL
      });
      return res.user;
    }

    // Invalidate cached session if expired/revoked
    sessionCache.delete(sessionToken);
  } catch (err) {
    console.error("[server-auth] Error resolving session user:", err);
  }

  return null;
}

/**
 * Enforces authentication and optional role-based access control on backend API routes.
 * Returns { user, error: null } on success.
 * Returns { user: null, error: NextResponse } with HTTP 401 or 403 on failure.
 */
export function requireAuth(
  request: NextRequest,
  allowedRoles?: string[]
): { user: AuthUser; error: null } | { user: null; error: NextResponse } {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        {
          error: "Authentication required. Please sign in to access this healthcare service.",
          authenticated: false,
          code: "AUTH_REQUIRED"
        },
        { status: 401 }
      )
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role?.toLowerCase();
    const isAllowed = allowedRoles.some((r) => r.toLowerCase() === userRole);
    if (!isAllowed) {
      return {
        user: null,
        error: NextResponse.json(
          {
            error: `Access denied. This feature requires ${allowedRoles.join(" or ")} privileges.`,
            authenticated: true,
            code: "FORBIDDEN"
          },
          { status: 403 }
        )
      };
    }
  }

  return { user, error: null };
}
