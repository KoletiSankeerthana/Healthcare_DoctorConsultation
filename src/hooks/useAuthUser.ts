"use client";

import { useAuth } from "@/contexts/AuthContext";
export type { UserSessionData } from "@/contexts/AuthContext";

/**
 * High-Performance Client Authentication Hook
 * Connects to centralized AuthProvider with instant localStorage caching,
 * eliminating redundant network requests and authentication race conditions.
 */
export function useAuthUser() {
  const { user, isAuthenticated, isLoading, refreshAuth } = useAuth();

  return {
    user,
    isAuthenticated,
    loading: isLoading,
    checkAuth: refreshAuth
  };
}
