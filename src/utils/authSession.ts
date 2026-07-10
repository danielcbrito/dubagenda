import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Valida a sessão no servidor antes de confiar no usuário local.
 * getSession() pode devolver sessão antiga do localStorage; getUser() revalida
 * no Supabase Auth e evita login fantasma de contas apagadas.
 */
export async function getVerifiedAuthUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore cleanup failures */
    }
    return null;
  }

  return data.user;
}
