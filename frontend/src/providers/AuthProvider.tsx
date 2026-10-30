import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { send, setToken, onUnauthorized } from "../services/client";
import { tokenStorage } from "../services/storage";
import { queryClient } from "./query";
import { establishSession, clearSession } from "../services/session";
import type { User, Session } from "../types/api";
type Auth = {
  user: User | null;
  loading: boolean;
  error: string | null;
  authenticate: (kind: "login" | "register", body: unknown) => Promise<void>;
  logout: () => Promise<void>;
  restore: () => Promise<void>;
};
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const logout = useCallback(async () => {
    generation.current++;
    setToken(null);
    setUser(null);
    setError(null);
    try {
      await clearSession({
        attach: setToken,
        erase: tokenStorage.clear,
        clearCache: async () => {
          await queryClient.cancelQueries();
          queryClient.clear();
        },
      });
    } catch {
      setError("Unable to remove the saved session. Please retry sign out.");
    }
  }, []);
  const restore = useCallback(async (silent = false) => {
    const g = ++generation.current;
    try {
      const token = await tokenStorage.read();
      if (g !== generation.current) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      if (!token) {
        setToken(null);
        setUser(null);
        return;
      }
      setToken(token);
      const result = await send<{ user: User }>("get", "/auth/me");
      if (g === generation.current) setUser(result.user);
    } catch (e) {
      if (g === generation.current) {
        if (!silent) setUser(null);
        setError(e instanceof Error ? e.message : "Unable to restore session.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);
  useEffect(() => {
    onUnauthorized(() => {
      void logout();
    });
    void Promise.resolve().then(() => restore());
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void restore(true);
    });
    return () => {
      listener.remove();
      onUnauthorized(() => {});
    };
  }, [logout, restore]);
  const authenticate = async (kind: "login" | "register", body: unknown) => {
    const g = ++generation.current;
    setUser(null);
    const identity = await establishSession(kind, body, {
      authenticate: (k, b) => send<Session>("post", "/auth/" + k, b),
      identify: () => send<{ user: User }>("get", "/auth/me"),
      write: tokenStorage.write,
      erase: tokenStorage.clear,
      attach: setToken,
      clearCache: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
      },
    });
    if (g === generation.current) {
      setError(null);
      setUser(identity);
    }
  };
  return (
    <Context.Provider
      value={{ user, loading, error, authenticate, logout, restore }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("Auth provider missing");
  return value;
}
