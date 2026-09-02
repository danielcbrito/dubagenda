import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Valida a sessão no servidor antes de confiar no usuário local.
 * getSession() pode devolver sessão antiga do localStorage; getUser() revalida
 * no Supabase Auth e evita login fantasma de contas apagadas.
 */
export async function getVerifiedAuthUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (!error && data.user) return data.user;

  // Falha de rede NÃO derruba a sessão — mantém o usuário logado offline.
  const status = (error as any)?.status;
  const isAuthError = status === 401 || status === 403;

  if (!isAuthError) {
    const { data: local } = await supabase.auth.getSession();
    if (local.session?.user) return local.session.user;
    return null;
  }

  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* ignore cleanup failures */
  }
  return null;
}
