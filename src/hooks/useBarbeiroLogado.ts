import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BarbeiroLogado {
  id: string;
  apelido: string;
  foto_url: string | null;
}

/**
 * Hook para obter o barbeiro logado com base no auth.uid()
 * Retorna null se o usuário não for um barbeiro
 */
export function useBarbeiroLogado() {
  const [barbeiro, setBarbeiro] = useState<BarbeiroLogado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBarbeiro = async () => {
      try {
        setLoading(true);
        setError(null);

        // Obter sessão atual
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user?.id) {
          setBarbeiro(null);
          setLoading(false);
          return;
        }

        // Buscar barbeiro vinculado ao user_id
        const { data, error: fetchError } = await supabase
          .from("barbeiros")
          .select("id, apelido, foto_url")
          .eq("user_id", session.user.id)
          .eq("ativo", true)
          .maybeSingle();

        if (fetchError) {
          console.error("Erro ao carregar barbeiro:", fetchError);
          setError(fetchError.message);
          setBarbeiro(null);
        } else {
          setBarbeiro(data);
        }
      } catch (err) {
        console.error("Erro inesperado ao carregar barbeiro:", err);
        setError("Erro ao carregar dados do barbeiro");
        setBarbeiro(null);
      } finally {
        setLoading(false);
      }
    };

    loadBarbeiro();

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadBarbeiro();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { barbeiro, loading, error, barbeiroId: barbeiro?.id || null };
}
