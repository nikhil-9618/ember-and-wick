import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { api, setAuthToken } from "@/api/client";
import type { ApiSession, SignupChallenge, User } from "@/api/types";

const TOKEN_KEY = "emberwick.session.token";

interface AuthValue {
  user: User | null;
  token: string | null;
  booting: boolean;
  /** Sign in with the password set on a verified account. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Step one of sign-up: creates an unverified account and emails a code. */
  startSignup: (input: { name: string; email: string; password: string; phone?: string }) => Promise<SignupChallenge>;
  /** Step two: verifies the emailed code and starts the session. */
  verifySignup: (challengeId: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function persistToken(token: string | null) {
  setAuthToken(token);
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!stored) return;
        setAuthToken(stored);
        const result = await api<{ user: User }>("/api/v1/auth/me");
        if (!active) return;
        setToken(stored);
        setUser(result.user);
      } catch {
        // Expired or revoked token: clear it and continue as a guest.
        await persistToken(null);
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await api<ApiSession>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    await persistToken(session.token);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const startSignup = useCallback(
    async (input: { name: string; email: string; password: string; phone?: string }) => {
      return api<SignupChallenge>("/api/v1/auth/register", { method: "POST", body: input });
    },
    [],
  );

  const verifySignup = useCallback(async (challengeId: string, code: string) => {
    const session = await api<ApiSession>("/api/v1/auth/register/verify", {
      method: "POST",
      body: { challengeId, code },
    });
    await persistToken(session.token);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // A failed server sign-out must not trap the user in a signed-in state.
    }
    await persistToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const result = await api<{ user: User }>("/api/v1/auth/me");
      setUser(result.user);
    } catch {
      // Keep the cached user; the next authenticated call will surface auth errors.
    }
  }, []);

  const value = useMemo(
    () => ({ user, token, booting, signIn, startSignup, verifySignup, signOut, refreshUser }),
    [user, token, booting, signIn, startSignup, verifySignup, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
