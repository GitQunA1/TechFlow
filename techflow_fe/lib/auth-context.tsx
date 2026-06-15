"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { login as apiLogin, storeToken, clearToken } from "./api";
import type { AuthUser } from "./types";

// ─────────────────────────────────────────────────────────────────────────────

const USER_KEY = "tf_user";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Restore session from localStorage on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        setUser(JSON.parse(raw) as AuthUser);
      }
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<AuthUser> => {
      const res = await apiLogin(username, password);

      const authUser: AuthUser = {
        token: res.token,
        userId: res.userId,
        role: res.role,
        categoryId: res.categoryId,
        departmentId: res.departmentId,
        username,
      };

      storeToken(res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      setUser(authUser);
      return authUser;
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
