import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Copy, Share2, Gift, Users, MessageCircle, Loader2, MousePointerClick, UserPlus, CalendarCheck, CheckCircle2, XCircle, Trophy, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BackArrow } from "@/components/ui/back-arrow";
import { cn } from "@/lib/utils";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Ciclo {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  vencedor_id: string | null;
  quantidade_indicacoes_vencedor: number | null;
  apurado_em: string | null;
}

interface Indicacao {
  id: string;
  indicado_id: string | null;
  status: string;
  criado_em: string;
  indicado_nome?: string | null;
  indicado_email?: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; Icon: any }> = {
  link_clicked: {
    label: "Entrou no link",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/20",
    Icon: MousePointerClick,
  },
  pendente: {
    label: "Criou conta",
    color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20",
    Icon: UserPlus,
  },
  agendado: {
    label: "Agendou",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
    Icon: CalendarCheck,
  },
  confirmado: {
    label: "Agendou",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
    Icon: CalendarCheck,
  },
  liberado: {
    label: "Serviço concluído",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20",
    Icon: CheckCircle2,
  },
  invalidado: {
    label: "Não elegível",
    color: "bg-muted text-muted-foreground ring-1 ring-border/40",
    Icon: XCircle,
  },
  expirado: {
    label: "Expirada",
    color: "bg-muted text-muted-foreground ring-1 ring-border/40",
    Icon: XCircle,
  },
};

const LIMITE_MENSAL = 4;

function getInviteOrigin() {
  return "https://dubagenda.lovable.app";
}

// Fallback de cópia — funciona em iframes/preview e mobile antigo onde
// navigator.clipboard falha silenciosamente.
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* try fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function ClienteIndicacoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [tenantSlug, setTenantSlug] = useState<string>("barbearia-dub");
  const [monthUsed, setMonthUsed] = useState(0);
  const [cicloAtivo, setCicloAtivo] = useState<Ciclo | null>(null);
  const [ciclosApurados, setCiclosApurados] = useState<Ciclo[]>([]);
  const [vencedoresNomes, setVencedoresNomes] = useState<Record<string, string>>({});

  const loadNames = useCallback(async (rows: Indicacao[]) => {
    const ids = Array.from(new Set(rows.map((r) => r.indicado_id).filter(Boolean))) as string[];
    if (ids.length === 0) return rows;
    const { data: infos } = await supabase.rpc("get_meus_indicados_info");
    const map: Record<string, { nome: string | null; email: string | null; telefone: string | null }> = {};
    (infos || []).forEach((p: any) => {
      map[p.id] = { nome: p.nome, email: p.email, telefone: p.telefone };
    });
    return rows.map((r) => ({
      ...r,
      indicado_nome: r.indicado_id ? map[r.indicado_id]?.nome ?? null : null,
      indicado_email: r.indicado_id
        ? map[r.indicado_id]?.email ?? map[r.indicado_id]?.telefone ?? null
        : null,
    }));
  }, []);

  const recomputeMonth = useCallback((rows: Indicacao[]) => {
    const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    // Só conta indicação após o serviço ser concluído (status = 'liberado')
    const monthValid = rows.filter(
      (r) => r.status === "liberado" && new Date(r.criado_em) >= startMonth
    ).length;
    setMonthUsed(monthValid);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);

      const [profileRes, creditsRes, indicacoesRes] = await Promise.all([
        supabase.from("profiles").select("referral_code, barbearia_preferida_id").eq("id", user.id).maybeSingle(),
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

      const tenantId = profileRes.data?.barbearia_preferida_id;
      if (tenantId) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("slug")
          .eq("id", tenantId)
          .maybeSingle();
        if (tenant?.slug) setTenantSlug(tenant.slug);
      }

      const rows: Indicacao[] = indicacoesRes.data || [];
      const enriched = await loadNames(rows);
      setIndicacoes(enriched);
      recomputeMonth(enriched);
      setLoading(false);
    })();
  }, [navigate, loadNames, recomputeMonth]);

  // Realtime — atualiza cliques/cadastros/agendamentos/conclusões ao vivo
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`indicacoes:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "indicacoes", filter: `indicador_id=eq.${userId}` },
        async () => {
          const { data } = await supabase
            .from("indicacoes")
            .select("id, indicado_id, status, criado_em")
            .eq("indicador_id", userId)
            .order("criado_em", { ascending: false });
          const enriched = await loadNames(data || []);
          setIndicacoes(enriched);
          recomputeMonth(enriched);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "creditos_indicacao", filter: `user_id=eq.${userId}` },
        async () => {
          const { count } = await supabase
            .from("creditos_indicacao")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "disponivel");
          setAvailableCredits(count || 0);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, loadNames, recomputeMonth]);

  const referralLink = useMemo(
    () => (referralCode ? `${getInviteOrigin()}/${tenantSlug}/${referralCode}` : ""),
    [referralCode, tenantSlug]
  );
  const prettyLink = referralLink.replace(/^https?:\/\//, "");

  const shareText = useMemo(
    () => `Baixe o app da Barbearia DUB pelo meu convite e ganhe um corte grátis: ${referralLink}`,
    [referralLink]
  );

  const handleCopy = async () => {
    if (!referralLink) return;
    const ok = await copyToClipboard(referralLink);
    if (ok) toast.success("Link copiado!");
    else toast.error("Não foi possível copiar. Toque em Enviar.");
  };

  const handleShareWhats = () => {
    if (!referralLink) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleShareNative = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      try { await navigator.share({ title: "Convite Barbearia DUB", text: shareText, url: referralLink }); }
      catch { /* cancelou */ }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/cliente/perfil");
          }}
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
                  <p className="text-2xl font-bold tabular-nums text-foreground">{availableCredits}</p>
                ) : (
                  <p className="text-[13px] text-muted-foreground mt-0.5">Indique amigos para ganhar</p>
                )}
              </div>
            </div>
          </motion.div>

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
              <div className="rounded-lg bg-muted/50 border border-border/30 px-3 py-2.5 text-[14px] font-mono font-medium text-foreground break-all">
                {referralLink ? prettyLink : "—"}
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

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2 px-1">
              Histórico ao vivo
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
                {indicacoes.map((ind, idx) => {
                  const meta = STATUS_META[ind.status] || STATUS_META.pendente;
                  const Icon = meta.Icon;
                  const isClick = ind.status === "link_clicked";
                  return (
                    <motion.div
                      key={ind.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="rounded-lg border border-border/30 bg-card p-3.5 flex items-center gap-3"
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                        isClick ? "bg-sky-500/10" : "bg-muted"
                      )}>
                        {isClick ? (
                          <Icon className="w-4 h-4 text-sky-500" />
                        ) : (
                          <span className="text-[11px] font-bold text-muted-foreground">
                            {ind.indicado_nome
                              ? ind.indicado_nome.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                              : "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground truncate">
                          {ind.indicado_nome || ind.indicado_email || (isClick ? "Alguém abriu seu link" : "Convidado")}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {format(new Date(ind.criado_em), "d 'de' MMM, HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md whitespace-nowrap flex items-center gap-1",
                          meta.color
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
