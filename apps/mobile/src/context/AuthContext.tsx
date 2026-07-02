import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "@/api/auth";
import { clearToken, getToken, setToken } from "@/api/client";
import type { AuthResponse } from "@/api/types";

interface AuthContextValue {
  user: AuthResponse["user"] | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthResponse["user"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const me = await authApi.fetchMe();
          setUser({ id: me.id, email: me.email, name: me.name });
        } catch {
          await clearToken();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await setToken(res.token);
    setUser(res.user);
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const res = await authApi.register(email, password, name);
    await setToken(res.token);
    setUser(res.user);
  };

  const signOut = async () => {
    await clearToken();
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, isLoading, signIn, signUp, signOut }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
