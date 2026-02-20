import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Search, Scissors, ChevronRight, Store, ArrowLeft, Check, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  // mode=change means user is changing their barbershop (from profile)
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
        if (!isChangeMode) {
          navigate("/cliente");
          return;
        }
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
        {/* Back button for change mode */}
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
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <Store className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] text-muted-foreground font-medium">
                {search ? "Nenhuma barbearia encontrada" : "Nenhuma barbearia disponível"}
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                {search ? "Tente outro nome ou bairro" : "Volte mais tarde"}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {filtered.map((tenant, index) => {
                const isCurrent = currentPreferred === tenant.id;
                return (
                  <motion.button
                    key={tenant.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => handleSelect(tenant.id)}
                    disabled={!!saving || isCurrent}
                    className={cn(
                      "w-full rounded-xl border p-4",
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
                      {/* Logo/Avatar */}
                      <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {tenant.logo_url ? (
                          <img
                            src={tenant.logo_url}
                            alt={tenant.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Scissors className="w-5 h-5 text-muted-foreground/60" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-foreground truncate">
                            {tenant.nome}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-px rounded flex-shrink-0">
                              Atual
                            </span>
                          )}
                        </div>
                        {tenant.slogan && (
                          <span className="block text-[11px] text-muted-foreground/70 truncate mt-0.5">
                            {tenant.slogan}
                          </span>
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

                      {/* Action */}
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
