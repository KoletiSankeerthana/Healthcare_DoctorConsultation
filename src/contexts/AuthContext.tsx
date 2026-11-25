"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface UserSessionData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  patient_id?: string;
  doctor_id?: string;
  session_id?: string;
}

interface AuthContextType {
  user: UserSessionData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userRole: string | null;
  login: (userData: UserSessionData, redirectUrl?: string) => void;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  userRole: null,
  login: () => {},
  logout: async () => {},
  refreshAuth: async () => {}
});

const USER_STORAGE_KEY = "mediverse_auth_user";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSessionData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial restoration from cache + live server sync
  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { "Cache-Control": "no-cache" }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setIsAuthenticated(true);
          try {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
          } catch (e) {}
          return;
        }
      } else if (res.status === 401) {
        setUser(null);
        setIsAuthenticated(false);
        try {
          localStorage.removeItem(USER_STORAGE_KEY);
        } catch (e) {}
        return;
      }
    } catch (e) {
      // On temporary network failure, preserve cached session if available
      console.warn("Auth sync check failed; falling back to cached session state:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Instant synchronous restore from localStorage to eliminate flicker
    try {
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) {
          setUser(parsed);
          setIsAuthenticated(true);
        }
      }
    } catch (e) {}

    // 2. Authoritative background validation with server session
    refreshAuth();
  }, [refreshAuth]);

  const login = useCallback((userData: UserSessionData, redirectUrl?: string) => {
    setUser(userData);
    setIsAuthenticated(true);
    setIsLoading(false);
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    } catch (e) {}

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
      sessionStorage.removeItem("mediverse_pending_booking");
    } catch (e) {}
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        userRole: user?.role || null,
        login,
        logout,
        refreshAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
