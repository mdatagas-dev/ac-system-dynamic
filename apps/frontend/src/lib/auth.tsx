"use client";

/**
 * VM3 Auth — context login/logout, token di lib/api.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { http, setTokens, clearTokens, getAccessToken, getRefreshToken, refreshAccessToken } from "@/lib/api";

export interface AuthUser {
  id: string;
  username: string;
  roleuser: string;
  depart: string;
  section?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeUser(token: string): AuthUser | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // reload: pulihkan sesi — coba refresh bila token access hilang
      let token = getAccessToken();
      if (!token && getRefreshToken()) {
        try {
          token = await refreshAccessToken();
        } catch {
          /* token refresh kedaluwarsa */
        }
      }
      if (!cancelled) {
        setUser(token ? decodeUser(token) : null);
        setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await http.post<{ accessToken: string; refreshToken: string }>(
        "/login",
        { username, password },
        { auth: false },
      );
      setTokens(data.accessToken, data.refreshToken);
      setUser(decodeUser(data.accessToken));
      router.replace("/");
    },
    [router],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
