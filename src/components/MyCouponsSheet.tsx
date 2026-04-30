import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Tag, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCache, setCache } from "@/utils/cache";
import { motion } from "framer-motion";

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

interface MyCouponsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

const CACHE_TTL_MIN = 0.5; // 30s

export function MyCouponsSheet({ open, onOpenChange, userId }: MyCouponsSheetProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && userId) loadCupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

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
      toast.success("Código copiado");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const useNow = (codigo: string) => {
    sessionStorage.setItem("preApplyCoupon", codigo);
    onOpenChange(false);
    navigate("/cliente/agendar");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl flex flex-col min-h-0">
        <SheetHeader className="flex-shrink-0 pr-8">
          <SheetTitle className="text-lg">Meus Cupons</SheetTitle>
          <SheetDescription className="text-xs">
            {cupons.length === 0
              ? "Nenhum cupom disponível"
              : `${cupons.length} ${cupons.length === 1 ? "cupom disponível" : "cupons disponíveis"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">Carregando...</p>
            </div>
          ) : cupons.length === 0 ? (
            <div className="text-center py-10">
              <Tag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Nenhum cupom disponível no momento
              </p>
            </div>
          ) : (
            cupons.map((c, idx) => {
              const isPrivate = c.escopo === "privado";
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="rounded-xl border border-border/40 bg-card p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                          {formatDesconto(c)}
                        </span>
                        {isPrivate && (
                          <span className="text-[8px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Pessoal
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => copyCode(c.codigo, c.id)}
                        className="inline-flex items-center gap-2 group"
                      >
                        <span className="font-mono text-base font-bold text-foreground tracking-wider">
                          {c.codigo}
                        </span>
                        {copiedId === c.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground/50 group-active:text-foreground" />
                        )}
                      </button>

                      {c.descricao && (
                        <p className="text-[12px] text-muted-foreground mt-1.5 line-clamp-2">
                          {c.descricao}
                        </p>
                      )}

                      {c.valido_ate && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1.5 uppercase tracking-wider">
                          Válido até {format(new Date(c.valido_ate), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => useNow(c.codigo)}
                    className="mt-3 w-full h-9 rounded-lg bg-foreground text-background text-[12px] font-semibold active:scale-[0.98] transition-transform"
                  >
                    Usar agora
                  </button>
                </motion.div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
