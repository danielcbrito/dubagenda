import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Share2, Gift, Users, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BackArrow } from "@/components/ui/back-arrow";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Indicacao {
  id: string;
  indicado_id: string | null;
  status: string;
  criado_em: string;
  indicado_nome?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Aguardando agendamento",
  agendado: "Aguardando atendimento",
  confirmado: "Confirmando...",
  liberado: "Corte grátis liberado!",
  invalidado: "Indicação não elegível",
  expirado: "Expirada",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
  agendado: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20",
  confirmado: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20",
  liberado: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20",
  invalidado: "bg-muted text-muted-foreground ring-1 ring-border/40",
  expirado: "bg-muted text-muted-foreground ring-1 ring-border/40",
};

const LIMITE_MENSAL = 10;

export default function ClienteIndicacoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [monthUsed, setMonthUsed] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const [profileRes, creditsRes, indicacoesRes] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
        supabase
          .from("creditos_indicacao")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "disponivel"),
        supabase
          .from("indicacoes")
          .select("id, indicado_id, status, criado_em")
          .eq("indicador_id", user.id)
          .order("criado_em", { ascending: false }),
      ]);

      setReferralCode(profileRes.data?.referral_code || null);
      setAvailableCredits(creditsRes.count || 0);

      const rows: Indicacao[] = indicacoesRes.data || [];

      // Contar indicações válidas do mês atual
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthValid = rows.filter(
        (r) => new Date(r.criado_em) >= startMonth && r.status !== "invalidado"
      ).length;
      setMonthUsed(monthValid);

      // Buscar apenas nomes dos indicados (nenhum outro dado sensível)
      const ids = Array.from(new Set(rows.map((r) => r.indicado_id).filter(Boolean))) as string[];
      let nomes: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", ids);
        (profs || []).forEach((p: any) => {
          nomes[p.id] = p.nome;
        });
      }

      setIndicacoes(rows.map((r) => ({ ...r, indicado_nome: r.indicado_id ? nomes[r.indicado_id] : null })));
      setLoading(false);
    })();
  }, [navigate]);

  const referralLink = useMemo(() => {
    if (!referralCode) return "";
    return `${window.location.origin}/?ref=${referralCode}`;
  }, [referralCode]);

  const shareText = useMemo(
    () =>
      `Ei! Baixe o app da Barbearia DUB usando meu convite e ganhe um corte grátis: ${referralLink}`,
    [referralLink]
  );

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleShareWhats = () => {
    if (!referralLink) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleShareNative = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Convite Barbearia DUB", text: shareText, url: referralLink });
      } catch {
        /* usuário cancelou */
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-card border border-border/40"
        >
          <BackArrow size={20} className="text-foreground" />
        </motion.button>
        <div>
          <h1 className="text-[15px] font-semibold text-foreground tracking-tight">Indicações</h1>
          <p className="text-[11px] text-muted-foreground/70">Indique amigos e ganhe cortes grátis</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-24 space-y-4">
          {/* Card Saldo */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border/40 bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Gift className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Cortes grátis disponíveis
                </p>
                {availableCredits > 0 ? (
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {availableCredits}
                  </p>
                ) : (
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    Indique amigos para ganhar
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Card Link */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-border/40 bg-card p-4 space-y-3"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">
                Seu link de convite
              </p>
              <div className="rounded-lg bg-muted/50 border border-border/30 px-3 py-2.5 text-[12px] font-mono text-foreground break-all">
                {referralLink || "—"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleCopy}
                className="h-10 rounded-lg bg-foreground text-background text-[12px] font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar
              </button>
              <button
                onClick={handleShareWhats}
                className="h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[12px] font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
              <button
                onClick={handleShareNative}
                className="h-10 rounded-lg bg-muted text-foreground text-[12px] font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              >
                <Share2 className="w-3.5 h-3.5" /> Enviar
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                Este mês
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {monthUsed} de {LIMITE_MENSAL} indicações
              </p>
            </div>
          </motion.div>

          {/* Lista */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
              Histórico
            </p>

            {indicacoes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 bg-card/40 p-8 flex flex-col items-center gap-2 text-center">
                <Users className="w-6 h-6 text-muted-foreground/40" />
                <p className="text-[12px] text-muted-foreground">
                  Nenhuma indicação ainda. Compartilhe seu link!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {indicacoes.map((ind, idx) => (
                  <motion.div
                    key={ind.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="rounded-lg border border-border/30 bg-card p-3.5 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {ind.indicado_nome
                          ? ind.indicado_nome
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground truncate">
                        {ind.indicado_nome || "Convidado"}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {format(new Date(ind.criado_em), "d 'de' MMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap",
                        STATUS_COLORS[ind.status] || STATUS_COLORS.pendente
                      )}
                    >
                      {STATUS_LABELS[ind.status] || ind.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
