import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Building2, MapPin, ChevronRight, Scissors, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

interface Unidade {
  id: string;
  nome: string;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  is_sede: boolean;
}

interface Barbeiro {
  id: string;
  apelido: string;
  foto_url: string | null;
  ativo: boolean;
}

interface UnidadesSectionProps {
  tenantId: string | null | undefined;
  tenantNome?: string;
  onAgendar?: (unidadeId: string) => void;
  className?: string;
}

function useUnidades(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["unidades-barbearia", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_unidades")
        .select("id, nome, bairro, cidade, estado, is_sede")
        .eq("tenant_id", tenantId!)
        .order("is_sede", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

function useUnidadeBarbeiros(unidadeId: string | null) {
  return useQuery({
    queryKey: ["unidade-barbeiros", unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbeiro_unidades")
        .select(`
          barbeiro:barbeiros!barbeiro_id (
            id, apelido, foto_url, ativo
          )
        `)
        .eq("unidade_id", unidadeId!);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? [])
        .map((row: any) => row.barbeiro as Barbeiro | null)
        .filter(Boolean)
        .filter((b) => b!.ativo) as Barbeiro[];
    },
    enabled: !!unidadeId,
    staleTime: 5 * 60 * 1000,
  });
}

function UnidadeDetailSheet({
  unidade,
  open,
  onOpenChange,
  tenantNome,
  onAgendar,
}: {
  unidade: Unidade | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantNome?: string;
  onAgendar?: (unidadeId: string) => void;
}) {
  const { data: barbeiros = [], isLoading } = useUnidadeBarbeiros(
    open && unidade ? unidade.id : null
  );

  const locationLine = [unidade?.bairro, unidade?.cidade, unidade?.estado]
    .filter(Boolean)
    .join(", ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border bg-background max-h-[88dvh] overflow-y-auto p-0">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <SheetTitle className="sr-only">
          {unidade?.nome ?? "Detalhes da unidade"}
        </SheetTitle>

        {unidade && (
          <>
            {/* Header */}
            <div className="px-5 pt-3 pb-5 border-b border-border">
              <div className="flex items-center gap-3.5 mb-3">
                <div
                  className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden border",
                    unidade.is_sede
                      ? "bg-primary/10 border-primary/20"
                      : "bg-secondary border-border"
                  )}
                >
                  <Building2
                    className={cn(
                      "w-6 h-6",
                      unidade.is_sede ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-xl font-bold text-foreground font-['Space_Grotesk'] truncate">
                      {unidade.nome}
                    </h2>
                    {unidade.is_sede && (
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                        Sede
                      </span>
                    )}
                  </div>
                  {tenantNome && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{tenantNome}</p>
                  )}
                </div>
              </div>

              {locationLine && (
                <div className="flex items-center gap-2.5 mt-2">
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] text-foreground">{locationLine}</p>
                </div>
              )}

            </div>

            {/* Barbeiros */}
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                  Equipe
                </span>
                {!isLoading && barbeiros.length > 0 && (
                  <span className="text-[11px] tabular-nums text-muted-foreground/50">
                    {barbeiros.length} profission{barbeiros.length === 1 ? "al" : "ais"}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : barbeiros.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center mb-2">
                    <Scissors className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    Nenhum profissional disponível
                  </p>
                </div>
              ) : (
                <div>
                  {barbeiros.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                      className={cn(
                        "flex items-center gap-3 py-3",
                        i < barbeiros.length - 1 && "border-b border-border/50"
                      )}
                    >
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted/30 border border-border/20 flex-shrink-0">
                        {b.foto_url ? (
                          <img src={b.foto_url} alt={b.apelido} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-muted-foreground">
                              {b.apelido.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background",
                            b.ativo ? "bg-emerald-500" : "bg-muted-foreground/30"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{b.apelido}</p>
                        <p className="text-[11px] text-muted-foreground">Barbeiro</p>
                      </div>
                      {b.ativo && (
                        <CheckCircle2 className="w-[15px] h-[15px] text-emerald-500 flex-shrink-0" />
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            {onAgendar && (
              <div className="px-5 pb-8 pt-2">
                <button
                  onClick={() => {
                    onOpenChange(false);
                    onAgendar(unidade.id);
                  }}
                  className={cn(
                    "w-full h-12 rounded-2xl flex items-center justify-center gap-2",
                    "bg-primary text-primary-foreground",
                    "font-['Space_Grotesk'] text-[15px] font-bold",
                    "active:scale-[0.97] transition-transform"
                  )}
                >
                  <Scissors className="w-4 h-4" />
                  Agendar nesta unidade
                </button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function UnidadesSection({ tenantId, tenantNome, onAgendar, className }: UnidadesSectionProps) {
  const { data: unidades = [], isLoading, error } = useUnidades(tenantId);
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);

  console.log('[UnidadesSection] tenantId:', tenantId, '| unidades:', unidades.length, '| loading:', isLoading, '| error:', error);

  if (!tenantId) return null;
  if (!isLoading && unidades.length <= 1) return null;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <span className="text-[13px] font-bold uppercase tracking-widest text-foreground">
            Unidades
          </span>
        </div>
        {!isLoading && unidades.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {unidades.length} locais
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {unidades.map((u, index) => {
            const loc = [u.bairro, u.cidade, u.estado].filter(Boolean).join(", ");
            return (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setSelectedUnidade(u)}
                className={cn(
                  "group relative w-full flex items-center gap-3 p-4 rounded-2xl",
                  "bg-card border border-border",
                  "hover:border-primary/30 active:scale-[0.985] transition-all text-left"
                )}
              >
                {u.is_sede && (
                  <div className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-primary" />
                )}

                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
                    u.is_sede
                      ? "bg-primary/10 border-primary/20"
                      : "bg-secondary border-border"
                  )}
                >
                  <Building2
                    className={cn(
                      "w-5 h-5",
                      u.is_sede ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold text-foreground font-['Space_Grotesk'] truncate">
                      {u.nome}
                    </p>
                    {u.is_sede && (
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded flex-shrink-0">
                        Sede
                      </span>
                    )}
                  </div>
                  {loc && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="w-[11px] h-[11px] text-muted-foreground/50 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{loc}</p>
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
              </motion.button>
            );
          })}
        </div>
      )}

      <UnidadeDetailSheet
        unidade={selectedUnidade}
        open={!!selectedUnidade}
        onOpenChange={(v) => { if (!v) setSelectedUnidade(null); }}
        tenantNome={tenantNome}
        onAgendar={onAgendar}
      />
    </div>
  );
}
