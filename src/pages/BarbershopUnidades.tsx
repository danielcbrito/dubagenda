import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, ChevronRight, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BackArrow } from "@/components/ui/back-arrow";

interface Unidade {
  id: string;
  nome: string;
  slug: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_sede: boolean;
  logo_url: string | null;
  telefone: string | null;
}

const BarbershopUnidades = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: shop } = useQuery({
    queryKey: ["shop-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, nome, slug, logo_url, slogan")
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });

  const { data: unidades = [], isLoading } = useQuery({
    queryKey: ["unidades", shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_unidades")
        .select("id, nome, slug, bairro, cidade, estado, is_sede, logo_url, telefone")
        .eq("tenant_id", shop!.id)
        .order("is_sede", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
    enabled: !!shop?.id,
    staleTime: 5 * 60 * 1000,
  });

  const handleUnitTap = (unidade: Unidade) => {
    if (unidade.slug) {
      navigate(`/b/${unidade.slug}`);
    } else {
      navigate(`/b/${slug}?unidade=${unidade.id}`);
    }
  };

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted/30 active:scale-90 transition-all text-foreground"
          >
            <BackArrow size={20} />
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-foreground leading-none tracking-tight font-['Space_Grotesk']">
              {shop?.nome ?? "Carregando..."}
            </h1>
            {!isLoading && unidades.length > 0 && (
              <p className="text-[10px] text-muted-foreground/35 mt-0.5 font-medium">
                {unidades.length} {unidades.length === 1 ? "unidade" : "unidades"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />

        <div className="h-full overflow-y-auto overscroll-contain px-5 pb-24">
          {isLoading ? (
            <div className="space-y-3 pt-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3.5 p-4 rounded-2xl border border-border bg-card"
                >
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : unidades.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-16"
            >
              <MapPin className="w-8 h-8 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma unidade encontrada
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2 pt-1">
              {unidades.map((u, index) => {
                const loc = [u.bairro, u.cidade].filter(Boolean).join(", ");
                const logoSrc = u.logo_url || shop?.logo_url || null;

                return (
                  <motion.button
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: index * 0.05,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    onClick={() => handleUnitTap(u)}
                    className={cn(
                      "group relative w-full flex items-center gap-3.5 p-4 rounded-2xl",
                      "bg-card border border-border",
                      "hover:border-primary/20 active:scale-[0.98] transition-all text-left"
                    )}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                  >
                    {/* Sede accent bar */}
                    {u.is_sede && (
                      <div className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-full bg-primary" />
                    )}

                    {/* Logo / Icon */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border",
                        u.is_sede
                          ? "bg-primary/10 border-primary/20"
                          : "bg-secondary border-border"
                      )}
                    >
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={u.nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/20">
                          <span className="text-[15px] font-bold text-muted-foreground/30 font-mono">
                            {u.nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold text-foreground font-['Space_Grotesk'] truncate">
                          {u.nome}
                        </span>
                        {u.is_sede && (
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded flex-shrink-0 font-mono">
                            Sede
                          </span>
                        )}
                      </div>
                      {loc ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">
                            {loc}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
                          <span className="text-xs text-muted-foreground/50 italic">
                            Endereço não informado
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarbershopUnidades;
