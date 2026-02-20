import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Search, Scissors, ChevronRight, ArrowLeft, Check, Crown } from "lucide-react";
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
        .update({ barbearia_preferida_id: tenantId, signup_origin: "discover" })
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
        .update({ barbearia_preferida_id: null, signup_origin: "dub_exclusive" })
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

  // Quem saiu da DUB (tem preferida em outro tenant)
  const leftDub = !!currentPreferred;

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh" }}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        {/* Back */}
        {isChangeMode && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/cliente/perfil")}
            className="mb-3 w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 active:scale-90 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-foreground/70" />
          </motion.button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4"
        >
          <h1 className="text-[18px] font-bold text-foreground tracking-tight">
            {isChangeMode ? "Trocar barbearia" : "Escolha sua barbearia"}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
            {isChangeMode
              ? "Selecione outra unidade como sua preferida"
              : "Selecione a barbearia mais perto de você"}
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="relative"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Buscar por nome ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full h-10 pl-10 pr-4 rounded-xl text-[13px]",
              "bg-card border border-border/50 text-foreground",
              "placeholder:text-muted-foreground/40",
              "focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15",
              "transition-all"
            )}
          />
        </motion.div>
      </div>

      {/* ── Scrollable ── */}
      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute top-0 left-0 right-0 h-3 z-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
        />
        <div className="h-full overflow-y-auto overscroll-contain px-5 pb-36">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-[11px] text-muted-foreground/60 mt-3 tracking-wide">Carregando...</p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">

              {/* ═══════════════════════════════════════════ */}
              {/*  DUB — Sempre primeiro, sempre referência  */}
              {/* ═══════════════════════════════════════════ */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <button
                  onClick={handleBackToDub}
                  disabled={!!saving}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left",
                    "active:scale-[0.98] transition-all duration-150",
                    "bg-card backdrop-blur-sm",
                    "dark:shadow-none shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
                    // Destaque sutil — borda primária, sem exageros
                    "border-primary/25 dark:border-primary/20",
                    saving === "dub" && "ring-2 ring-primary/30",
                    saving && saving !== "dub" && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center flex-shrink-0 overflow-hidden border border-primary/15">
                      <img src={logoDub} alt="DUB" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-foreground">Barbearia DUB</span>
                        <span className="text-[8px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                          <Crown className="w-2.5 h-2.5 inline -mt-px mr-0.5" />
                          Referência
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        Corte masculino premium • Atendimento exclusivo
                      </p>
                    </div>
                    {saving === "dub" ? (
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                    ) : !currentPreferred ? (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
                      </div>
                    ) : (
                      <ChevronRight className="w-5 h-5 text-primary/50 flex-shrink-0" />
                    )}
                  </div>

                  {/* Mensagem estratégica para quem saiu */}
                  {leftDub && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-[11px] text-primary/80 font-medium text-center">
                        Voltar para atendimento exclusivo DUB
                      </p>
                    </div>
                  )}
                </button>
              </motion.div>

              {/* ── Divider ── */}
              {filtered.length > 0 && (
                <div className="flex items-center gap-3 py-2 px-1">
                  <div className="flex-1 h-px bg-border/30" />
                  <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/35 font-semibold">
                    Barbearias disponíveis
                  </span>
                  <div className="flex-1 h-px bg-border/30" />
                </div>
              )}

              {/* ── Empty state ── */}
              {filtered.length === 0 && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-14"
                >
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <Scissors className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                  <p className="text-[13px] text-muted-foreground font-medium">
                    {search ? "Nenhuma barbearia encontrada" : "Nenhuma outra barbearia disponível"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1">
                    {search ? "Tente outro nome ou bairro" : "Novas unidades em breve"}
                  </p>
                </motion.div>
              )}

              {/* ── Tenant cards ── */}
              {filtered.map((tenant, index) => {
                const isCurrent = currentPreferred === tenant.id;
                return (
                  <motion.button
                    key={tenant.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 + index * 0.03 }}
                    onClick={() => handleSelect(tenant.id)}
                    disabled={!!saving || isCurrent}
                    className={cn(
                      "w-full rounded-xl border p-3.5 text-left",
                      "active:scale-[0.98] transition-all duration-150",
                      "bg-card/80 backdrop-blur-sm",
                      "dark:shadow-none shadow-[0_1px_6px_rgba(0,0,0,0.04)]",
                      isCurrent ? "border-primary/30 bg-primary/5" : "border-border/40",
                      saving === tenant.id && "ring-2 ring-primary/30 border-primary/25",
                      saving && saving !== tenant.id && !isCurrent && "opacity-40"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {tenant.logo_url ? (
                          <img src={tenant.logo_url} alt={tenant.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Scissors className="w-4.5 h-4.5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground truncate">{tenant.nome}</span>
                          {isCurrent && (
                            <span className="text-[8px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-px rounded flex-shrink-0">
                              Atual
                            </span>
                          )}
                        </div>
                        {tenant.slogan && (
                          <span className="block text-[11px] text-muted-foreground/60 truncate mt-0.5">{tenant.slogan}</span>
                        )}
                        {(tenant.bairro || tenant.cidade) && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-muted-foreground/30 flex-shrink-0" />
                            <span className="text-[10px] text-muted-foreground/45 truncate">
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
                        <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/30 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div
          className="h-6 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--background)))" }}
        />
        <div className="bg-background border-t border-border/20 px-5 pb-safe">
          <div className="pt-2.5 pb-3">
            <button
              onClick={handleSkip}
              className="w-full text-center text-[12px] text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2 rounded-xl"
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
