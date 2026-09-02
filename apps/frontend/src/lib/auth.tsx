"use client";

/**
 * VM3 Auth — context login/logout session-based (cookie HttpOnly).
 * Session dikelola server (Redis); token tidak pernah terlihat JS.
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
import { http } from "@/lib/api";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();

  // Cek session saat load: coba akses endpoint publik yang mengembalikan user
  // Kalau session masih valid, setUser. Kalau tidak, user=null.
  useEffect(() => {
    let cancelled = false;
    http
      .get<{ user: AuthUser }>("/auth/me")
      .then((res) => {
        if (!cancelled) setUser(res.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await http.post<{ message: string; user: AuthUser }>(
        "/auth/login",
        { username, password },
      );
      setUser(data.user);
      router.replace("/");
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await http.post("/auth/logout");
    } catch {
      /* abaikan — cookie tetap dihapus server walau gagal */
    }
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