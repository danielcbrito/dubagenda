import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Search, Scissors, ChevronRight, Store, ArrowLeft, Check, Star, Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logoDub from "@/assets/logo-dub.png";

interface Tenant {
  id: string;
  nome: string;
  slogan: string | null;
  logo_url: string | null;
  cidade: string | null;
  bairro: string | null;
  estado: string | null;
}

const EscolherBarbearia = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPreferred, setCurrentPreferred] = useState<string | null>(null);

  const isChangeMode = searchParams.get("mode") === "change";

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?mode=login");
        return;
      }
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("barbearia_preferida_id")
        .eq("id", session.user.id)
        .single();

      if (profile?.barbearia_preferida_id) {
        setCurrentPreferred(profile.barbearia_preferida_id);
      }

      await loadTenants();
    };
    init();
  }, []);

  const loadTenants = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("id, nome, slogan, logo_url, cidade, bairro, estado")
      .eq("ativo", true)
      .eq("onboarding_completed", true)
      .order("nome");

    if (error) {
      console.error("Erro ao carregar barbearias:", error);
      toast.error("Erro ao carregar barbearias");
    }
    setTenants(data || []);
    setIsLoading(false);
  };

  const handleSelect = async (tenantId: string) => {
    if (!userId || saving) return;
    setSaving(tenantId);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          barbearia_preferida_id: tenantId,
          signup_origin: "discover",
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success(isChangeMode ? "Barbearia atualizada!" : "Barbearia selecionada!");
      navigate(isChangeMode ? "/cliente/perfil" : "/cliente");
    } catch (err) {
      console.error("Erro ao salvar barbearia:", err);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(null);
    }
  };

  const handleBackToDub = async () => {
    if (!userId) return;
    setSaving("dub");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          barbearia_preferida_id: null,
          signup_origin: "dub_exclusive",
        })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Você voltou para o modo DUB Exclusivo!");
      navigate("/cliente");
    } catch (err) {
      console.error("Erro ao voltar para DUB:", err);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setSaving(null);
    }
  };

  const handleSkip = () => {
    navigate(isChangeMode ? "/cliente/perfil" : "/cliente");
  };

  const filtered = tenants.filter(t =>
    t.nome.toLowerCase().includes(search.toLowerCase()) ||
    (t.bairro && t.bairro.toLowerCase().includes(search.toLowerCase())) ||
    (t.cidade && t.cidade.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
        {isChangeMode && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/cliente/perfil")}
            className="mb-4 w-8 h-8 flex items-center justify-center rounded-lg bg-card/60 border border-border/30 active:scale-90 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-foreground/70" />
          </motion.button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center mb-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3.5">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight text-center">
            {isChangeMode ? "Trocar barbearia" : "Escolha sua barbearia"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1.5 text-center max-w-[280px] leading-relaxed">
            {isChangeMode
              ? "Selecione outra barbearia como sua preferida"
              : "Selecione a barbearia mais perto de você para começar"}
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Buscar por nome ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </motion.div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-3 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />
        <div className="h-full overflow-y-auto overscroll-contain px-5 pb-32">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-[12px] text-muted-foreground mt-3">Carregando barbearias...</p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* ══════════════════════════════════════════════ */}
              {/* DUB PREMIUM — Sempre no topo, sempre destaque */}
              {/* ══════════════════════════════════════════════ */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={cn(
                  "rounded-2xl border-2 p-4 relative overflow-hidden",
                  "border-primary/40 dark:border-primary/30",
                  "bg-gradient-to-br from-primary/8 via-primary/3 to-transparent",
                  "dark:from-primary/10 dark:via-primary/5 dark:to-transparent",
                  "shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-none"
                )}
              >
                {/* Sparkle accent */}
                <div className="absolute top-3 right-3">
                  <Sparkles className="w-4 h-4 text-primary/30" />
                </div>

                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-card flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-primary/20 shadow-sm">
                    <img src={logoDub} alt="DUB" className="w-10 h-10 object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[15px] font-bold text-foreground">Barbearia DUB</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
                        <Crown className="w-2.5 h-2.5" />
                        Premium
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Referência em corte masculino premium
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Star key={i} className="w-2.5 h-2.5 text-primary fill-primary" />
                        ))}
                      </div>
                      <span className="text-[10px] text-muted-foreground/50">•</span>
                      <span className="text-[10px] text-primary/70 font-medium">Recomendada</span>
                    </div>
                  </div>
                </div>

                {/* CTA — Voltar / Ser exclusivo */}
                <button
                  onClick={handleBackToDub}
                  disabled={!!saving}
                  className={cn(
                    "w-full mt-3.5 h-10 rounded-xl text-[12px] font-semibold",
                    "bg-primary text-primary-foreground",
                    "active:scale-[0.98] transition-all duration-150",
                    "flex items-center justify-center gap-2",
                    saving === "dub" && "opacity-70"
                  )}
                >
                  {saving === "dub" ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <>
                      <Crown className="w-3.5 h-3.5" />
                      {currentPreferred ? "Voltar para DUB Exclusivo" : "Ser cliente exclusivo"}
                    </>
                  )}
                </button>
              </motion.div>

              {/* Separator */}
              {filtered.length > 0 && (
                <div className="flex items-center gap-3 pt-2 pb-1 px-1">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold flex-shrink-0">
                    Outras barbearias
                  </span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}

              {/* Other barbershops */}
              {filtered.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-12"
                >
                  <Store className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-[13px] text-muted-foreground font-medium">
                    {search ? "Nenhuma barbearia encontrada" : "Nenhuma outra barbearia disponível"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    {search ? "Tente outro nome ou bairro" : "A Barbearia DUB é a referência para você"}
                  </p>
                </motion.div>
              )}

              {filtered.map((tenant, index) => {
                const isCurrent = currentPreferred === tenant.id;
                return (
                  <motion.button
                    key={tenant.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.03 }}
                    onClick={() => handleSelect(tenant.id)}
                    disabled={!!saving || isCurrent}
                    className={cn(
                      "w-full rounded-xl border p-3.5",
                      "active:scale-[0.98] transition-all duration-150",
                      "bg-card/80 backdrop-blur-sm",
                      "dark:shadow-none shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
                      "text-left",
                      isCurrent && "border-primary/40 bg-primary/5",
                      !isCurrent && "border-border/50",
                      saving === tenant.id && "ring-2 ring-primary/40 border-primary/30",
                      saving && saving !== tenant.id && !isCurrent && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Scissors className="w-5 h-5 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground truncate">{tenant.nome}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-px rounded flex-shrink-0">
                              Atual
                            </span>
                          )}
                        </div>
                        {tenant.slogan && (
                          <span className="block text-[11px] text-muted-foreground/70 truncate mt-0.5">{tenant.slogan}</span>
                        )}
                        {(tenant.bairro || tenant.cidade) && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                            <span className="text-[11px] text-muted-foreground/50 truncate">
                              {[tenant.bairro, tenant.cidade, tenant.estado].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                      {saving === tenant.id ? (
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
                        </div>
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div
          className="h-8 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
        />
        <div className="bg-background border-t border-border/30 px-5 pb-safe">
          <div className="pt-3 pb-4">
            <button
              onClick={handleSkip}
              className="w-full text-center text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-2.5 rounded-xl"
            >
              {isChangeMode ? "Cancelar" : "Pular por agora"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EscolherBarbearia;
