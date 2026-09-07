import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Tag, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCache, setCache } from "@/utils/cache";
import { motion } from "framer-motion";
import { BackArrow } from "@/components/ui/back-arrow";

interface Cupom {
  id: string;
  codigo: string;
  descricao: string | null;
  tipo_desconto: string;
  valor_desconto: number;
  escopo: string;
  cliente_user_id: string | null;
  valido_ate: string | null;
}

const CACHE_TTL_MIN = 0.5; // 30s

export default function ClienteCupons() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      } else {
        navigate("/auth");
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      loadCupons();
    }
  }, [userId]);

  const loadCupons = async () => {
    if (!userId) return;
    const cacheKey = `meus-cupons-${userId}`;
    const cached = getCache<Cupom[]>(cacheKey);
    if (cached) {
      setCupons(cached);
    } else {
      setLoading(true);
    }

    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("cupons")
        .select("id, codigo, descricao, tipo_desconto, valor_desconto, escopo, cliente_user_id, valido_ate")
        .eq("ativo", true)
        .or(`escopo.eq.publico,and(escopo.eq.privado,cliente_user_id.eq.${userId})`)
        .or(`valido_ate.is.null,valido_ate.gt.${nowIso}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const list = (data || []) as Cupom[];
      setCupons(list);
      setCache(cacheKey, list, CACHE_TTL_MIN);
    } catch (err: any) {
      console.error("Erro ao carregar cupons:", err);
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  const formatDesconto = (c: Cupom) => {
    if (c.tipo_desconto === "percentual") return `${Number(c.valor_desconto)}% OFF`;
    return `R$ ${Number(c.valor_desconto).toFixed(2).replace(".", ",")} OFF`;
  };

  const copyCode = async (codigo: string, id: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiedId(id);
      toast.success("Código copiado!");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const useNow = (codigo: string) => {
    sessionStorage.setItem("preApplyCoupon", codigo);
    navigate("/cliente/agendar");
  };

  return (
    <div className="h-full w-full bg-[#FFFFFF] dark:bg-background relative overflow-y-auto overscroll-contain">
      <div className="max-w-2xl mx-auto px-5 pt-[max(calc(env(safe-area-inset-top,0px)+1.5rem),2rem)] pb-32">
        {/* Header no mesmo padrão do agendamento — Botão circular sem barra cortando */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white dark:bg-card border border-neutral-200/70 dark:border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-neutral-900 dark:text-foreground active:scale-90 transition-transform cursor-pointer"
            aria-label="Voltar"
          >
            <BackArrow size={20} strokeWidth={2.2} />
          </button>
        </div>

        {/* Título da tela idêntico ao padrão de agendamento */}
        <div className="mb-6">
          <h1 className="text-[25px] sm:text-[27px] font-bold text-neutral-900 dark:text-foreground tracking-tight leading-tight font-sans">
            Meus Cupons
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-muted-foreground mt-1">
            {cupons.length > 0
              ? `${cupons.length} ${cupons.length === 1 ? "cupom disponível" : "cupons disponíveis"}`
              : "Descontos e vantagens exclusivas"}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-3" />
            <p className="text-[13px] text-muted-foreground">Carregando cupons...</p>
          </div>
        ) : cupons.length === 0 ? (
          <div className="text-center py-24">
            <Tag className="w-9 h-9 mx-auto mb-3 text-neutral-400 dark:text-muted-foreground stroke-[1.5]" />
            <h3 className="text-[15px] font-medium text-neutral-900 dark:text-foreground">
              Nenhum cupom disponível
            </h3>
            <p className="text-[12px] text-neutral-400 dark:text-muted-foreground mt-1">
              Fique de olho em novas promoções da sua barbearia.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {cupons.map((c, idx) => {
              const isPrivate = c.escopo === "privado";
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="rounded-2xl border border-neutral-200/70 dark:border-border/60 bg-white dark:bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                          {formatDesconto(c)}
                        </span>
                        {isPrivate && (
                          <span className="text-[10px] font-medium uppercase tracking-wider bg-neutral-100 dark:bg-muted text-neutral-600 dark:text-neutral-400 px-1.5 py-0.5 rounded-md">
                            Exclusivo
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => copyCode(c.codigo, c.id)}
                        className="inline-flex items-center gap-2 group mb-2 px-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-muted/40 border border-neutral-200/60 dark:border-border/40 hover:bg-neutral-100 transition-colors"
                      >
                        <span className="font-mono text-[15px] font-bold text-foreground tracking-wider">
                          {c.codigo}
                        </span>
                        {copiedId === c.id ? (
                          <Check className="w-4 h-4 text-emerald-500" strokeWidth={2.5} />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" strokeWidth={2} />
                        )}
                      </button>

                      {c.descricao && (
                        <p className="text-[13px] text-neutral-600 dark:text-muted-foreground line-clamp-2 mt-1">
                          {c.descricao}
                        </p>
                      )}

                      {c.valido_ate && (
                        <p className="text-[11px] font-medium text-neutral-400 dark:text-muted-foreground/70 mt-2 uppercase tracking-wider">
                          Válido até {format(new Date(c.valido_ate), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => useNow(c.codigo)}
                    className="mt-4 w-full h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-primary dark:hover:bg-primary/90 text-white dark:text-primary-foreground text-[13px] font-semibold active:scale-[0.98] transition-transform shadow-sm"
                  >
                    Usar agora
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}