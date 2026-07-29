import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "dub-agenda-auth";

interface AuthState {
  /** Usuário disponível imediatamente (otimista, vindo do localStorage). */
  user: User | null;
  session: Session | null;
  /** true quando o SDK já hidratou a sessão (nunca bloqueia o primeiro paint). */
  hydrated: boolean;
  /** true quando o servidor já confirmou (ou negou) a sessão. */
  verified: boolean;
}

/**
 * Lê a sessão persistida de forma SÍNCRONA para evitar flash de tela branca.
 * O token só é considerado válido se ainda não expirou.
 */
function readCachedSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session: Session | null = parsed?.currentSession ?? parsed ?? null;
    if (!session?.access_token) return null;
    if (session.expires_at && session.expires_at * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  hydrated: false,
  verified: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = useRef<Session | null>(readCachedSession());
  const [session, setSession] = useState<Session | null>(initial.current);
  const [hydrated, setHydrated] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setHydrated(true);
    });

    // Hidratação local (sem rede) — resolve praticamente instantâneo.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setHydrated(true);
    });

    // Verificação com o servidor em background (não bloqueia render).
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        // Só derruba a sessão em erro de autorização real, nunca por falha de rede.
        const status = (error as any)?.status;
        if (status === 401 || status === 403) {
          supabase.auth.signOut({ scope: "local" }).catch(() => {});
          setSession(null);
        }
      }
      setVerified(true);
    }).catch(() => setVerified(true));

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user: session?.user ?? null, session, hydrated, verified }),
    [session, hydrated, verified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Acesso síncrono fora do React (guards, loaders). */
export function getCachedUser(): User | null {
  return readCachedSession()?.user ?? null;
}
