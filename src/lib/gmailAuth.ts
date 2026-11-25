/**
 * MediVerse Production Gmail OAuth 2.0 Token Manager
 * Handles OAuth configuration, secure storage (SQLite + server-side token store),
 * automatic token refresh before expiration, and status checks.
 * NEVER exposes secrets or tokens to the client browser.
 */

import fs from "fs";
import path from "path";
import { callDbBridge } from "./pythonBridge";

export interface StoredOAuthTokens {
  id?: string;
  provider?: string;
  account_email?: string;
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_at?: number; // Unix timestamp in milliseconds
  created_at?: string;
  updated_at?: string;
}

export interface GmailOAuthStatus {
  isConfigured: boolean;
  isAuthorized: boolean;
  accountEmail: string | null;
  scope: string | null;
  expiresAt: string | null;
  hasRefreshToken: boolean;
}

const TOKEN_STORAGE_DIR = path.join(process.cwd(), "backend", "storage", "tokens");
const TOKEN_FILE_PATH = path.join(TOKEN_STORAGE_DIR, "gmail_oauth.json");

/**
 * Returns Google OAuth client ID from server environment.
 */
export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GMAIL_CLIENT_ID ||
    ""
  ).trim();
}

/**
 * Returns Google OAuth client secret from server environment.
 */
export function getGoogleClientSecret(): string {
  return (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GMAIL_CLIENT_SECRET ||
    ""
  ).trim();
}

/**
 * Returns configured redirect URI. Defaults to canonical localhost callback.
 */
export function getGoogleRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    process.env.GMAIL_REDIRECT_URI ||
    "http://localhost:3000/api/auth/callback/google"
  ).trim();
}

/**
 * Ensures backend token storage directory exists with private permissions.
 */
function ensureStorageDirectory() {
  try {
    if (!fs.existsSync(TOKEN_STORAGE_DIR)) {
      fs.mkdirSync(TOKEN_STORAGE_DIR, { recursive: true });
    }
  } catch (err) {
    console.error("[gmailAuth] Failed to create token storage directory:", err);
  }
}

/**
 * Reads stored OAuth tokens from server storage layers:
 * 1. Secure token file
 * 2. SQLite oauth_tokens table via dbBridge
 * 3. Environment variables fallback
 */
export function getStoredOAuthTokens(): StoredOAuthTokens | null {
  // Layer 1: Check local persistent file
  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      const content = fs.readFileSync(TOKEN_FILE_PATH, "utf-8");
      if (content.trim()) {
        const parsed = JSON.parse(content);
        if (parsed.refresh_token || parsed.access_token) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.warn("[gmailAuth] Could not read token file:", e);
  }

  // Layer 2: Check SQLite database
  try {
    const dbRes = callDbBridge("get_oauth_token", ["gmail"]) as any;
    if (dbRes?.success && dbRes.token) {
      const tok = dbRes.token;
      const normalized: StoredOAuthTokens = {
        id: tok.id,
        provider: tok.provider,
        account_email: tok.account_email,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token,
        scope: tok.scope,
        token_type: tok.token_type,
        // Convert seconds from DB to milliseconds if needed
        expires_at: tok.expires_at ? (tok.expires_at > 10000000000 ? tok.expires_at : tok.expires_at * 1000) : undefined,
        created_at: tok.created_at,
        updated_at: tok.updated_at
      };

      // Self-heal local file
      try {
        ensureStorageDirectory();
        fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(normalized, null, 2), "utf-8");
      } catch (_) {}

      return normalized;
    }
  } catch (e) {
    console.warn("[gmailAuth] Could not query database token:", e);
  }

  // Layer 3: Environment variables fallback
  const envRefreshToken = process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
  const envAccessToken = process.env.GMAIL_ACCESS_TOKEN || process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  const envSender = process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER;

  if (envRefreshToken || envAccessToken) {
    return {
      id: "gmail",
      provider: "google",
      account_email: envSender,
      access_token: envAccessToken,
      refresh_token: envRefreshToken,
      token_type: "Bearer",
      expires_at: envAccessToken ? Date.now() + 3600 * 1000 : 0
    };
  }

  return null;
}

/**
 * Persists OAuth tokens securely into both file system and SQLite database.
 */
export function saveOAuthTokens(tokens: StoredOAuthTokens): boolean {
  try {
    ensureStorageDirectory();

    // Preserve existing refresh token if Google does not return a new one on refresh
    const existing = getStoredOAuthTokens();
    const finalTokens: StoredOAuthTokens = {
      id: "gmail",
      provider: "google",
      account_email: tokens.account_email || existing?.account_email,
      access_token: tokens.access_token || existing?.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token,
      scope: tokens.scope || existing?.scope || "https://www.googleapis.com/auth/gmail.send",
      token_type: tokens.token_type || existing?.token_type || "Bearer",
      expires_at: tokens.expires_at || existing?.expires_at,
      updated_at: new Date().toISOString()
    };

    // Save to secure server file
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(finalTokens, null, 2), "utf-8");

    // Save to SQLite database
    const dbPayload = {
      id: "gmail",
      provider: "google",
      account_email: finalTokens.account_email,
      access_token: finalTokens.access_token,
      refresh_token: finalTokens.refresh_token,
      scope: finalTokens.scope,
      token_type: finalTokens.token_type,
      // Store expires_at in seconds in SQLite
      expires_at: finalTokens.expires_at ? Math.floor(finalTokens.expires_at / 1000) : null
    };

    callDbBridge("save_oauth_token", [], dbPayload);
    console.info("[gmailAuth] Successfully persisted OAuth tokens to server storage.");
    return true;
  } catch (err) {
    console.error("[gmailAuth] Failed to save OAuth tokens:", err);
    return false;
  }
}

/**
 * Exchanges OAuth authorization code with Google token endpoint for access and refresh tokens.
 */
export async function exchangeAuthCodeForTokens(code: string): Promise<{
  success: boolean;
  tokens?: StoredOAuthTokens;
  accountEmail?: string;
  error?: string;
}> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const redirectUri = getGoogleRedirectUri();

  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: "Google OAuth Client ID or Client Secret is missing from backend configuration."
    };
  }

  try {
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const bodyParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString()
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      const detail = data.error_description || data.error || "Token exchange failed";
      console.error("[gmailAuth] Google token exchange rejected:", detail);
      return { success: false, error: detail };
    }

    // Attempt to inspect the authenticated Gmail email address from the user profile
    let accountEmail = process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER || "";
    if (data.access_token) {
      try {
        const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.emailAddress) {
            accountEmail = profileData.emailAddress;
          }
        }
      } catch (profileErr) {
        console.warn("[gmailAuth] Could not fetch Gmail profile email:", profileErr);
      }
    }

    const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
    const expiresAt = Date.now() + expiresInMs;

    const tokenPayload: StoredOAuthTokens = {
      id: "gmail",
      provider: "google",
      account_email: accountEmail,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      scope: data.scope || "https://www.googleapis.com/auth/gmail.send",
      token_type: data.token_type || "Bearer",
      expires_at: expiresAt
    };

    saveOAuthTokens(tokenPayload);

    return {
      success: true,
      tokens: tokenPayload,
      accountEmail
    };
  } catch (err: any) {
    console.error("[gmailAuth] Unexpected token exchange error:", err);
    return {
      success: false,
      error: err.message || "Network error while exchanging authorization code with Google."
    };
  }
}

/**
 * Returns a valid, non-expired access token.
 * Automatically refreshes the token using the refresh_token if expired or nearing expiration.
 */
export async function getValidGmailAccessToken(): Promise<string | null> {
  const tokens = getStoredOAuthTokens();
  if (!tokens) {
    return null;
  }

  // Safety buffer of 5 minutes (300,000 ms)
  const isFresh = tokens.access_token && tokens.expires_at && tokens.expires_at > Date.now() + 5 * 60 * 1000;
  if (isFresh && tokens.access_token) {
    return tokens.access_token;
  }

  // Token is expired or missing; check if we have a refresh token
  const refreshToken = tokens.refresh_token || process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    console.warn("[gmailAuth] Stored access token is expired and no refresh token is available.");
    return null;
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    console.warn("[gmailAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET to refresh token.");
    return tokens.access_token || null;
  }

  try {
    console.info("[gmailAuth] Access token expired or nearing expiration. Refreshing with Google OAuth...");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      }).toString()
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.error("[gmailAuth] Token refresh failed:", data.error_description || data.error);
      return null;
    }

    const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
    const newExpiresAt = Date.now() + expiresInMs;

    const updatedTokens: StoredOAuthTokens = {
      ...tokens,
      access_token: data.access_token,
      // Google may or may not return a new refresh token on refresh
      refresh_token: data.refresh_token || refreshToken,
      expires_at: newExpiresAt
    };

    saveOAuthTokens(updatedTokens);
    console.info("[gmailAuth] Access token refreshed successfully. Valid until:", new Date(newExpiresAt).toISOString());
    return data.access_token;
  } catch (err) {
    console.error("[gmailAuth] Error while refreshing access token:", err);
    return null;
  }
}

/**
 * Returns safe, high-level status of Gmail OAuth authorization (never reveals secrets).
 */
export function getGmailOAuthStatus(): GmailOAuthStatus {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  const isConfigured = Boolean(clientId && clientSecret);

  const tokens = getStoredOAuthTokens();
  const hasRefreshToken = Boolean(tokens?.refresh_token || process.env.GMAIL_REFRESH_TOKEN);
  const isAuthorized = Boolean(tokens?.access_token || hasRefreshToken);

  return {
    isConfigured,
    isAuthorized,
    accountEmail: tokens?.account_email || process.env.GMAIL_SENDER_EMAIL || null,
    scope: tokens?.scope || null,
    expiresAt: tokens?.expires_at ? new Date(tokens.expires_at).toISOString() : null,
    hasRefreshToken
  };
}
