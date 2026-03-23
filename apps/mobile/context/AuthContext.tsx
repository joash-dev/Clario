import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMeRequest,
  loginRequest,
  setAuthToken,
  setSessionExpiredHandler,
  type AuthUser,
} from "../services/api";
import { clearToken, getToken, setToken } from "../utils/storage";

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(async () => {
    await clearToken();
    setAuthToken(null);
    setUser(null);
  }, []);

  const hydrate = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await getToken();
      if (!stored) {
        setAuthToken(null);
        setUser(null);
        return;
      }
      setAuthToken(stored);
      try {
        const me = await getMeRequest();
        setUser(me);
      } catch {
        await clearSession();
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      void clearSession();
    });
    return () => setSessionExpiredHandler(null);
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginRequest(email, password);
      await setToken(result.token);
      setAuthToken(result.token);
      try {
        const me = await getMeRequest();
        setUser(me);
      } catch {
        await clearSession();
        throw new Error("Unable to load profile");
      }
    },
    [clearSession]
  );

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !isLoading && user !== null,
      login,
      logout,
    }),
    [user, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
