import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Loader2,
  Receipt,
  ShieldCheck,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackArrow } from "@/components/ui/back-arrow";

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface PreviewCredit {
  id: string;
  description: string;
  amount: number;
  fee: number;
  net: number;
  created_at: string;
}

interface PreviewData {
  credits: PreviewCredit[];
  grossAmount: number;
  feePerCredit?: number;
  creditsCount: number;
  totalFee: number;
  netAmount: number;
  message?: string;
}


interface RefundResult {
  creditsProcessed: number;
  grossAmount: number;
  totalFee: number;
  netAmount: number;
  message?: string;
}

type View = "home" | "confirm" | "success";

const brl = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
const firstName = (name?: string | null) => (name || "Cliente").trim().split(/\s+/)[0] || "Cliente";

const moneyInTypes = new Set(["refund", "recharge", "convert_credits", "credit", "wallet_credit"]);
const moneyOutTypes = new Set(["payment", "withdraw", "transfer", "wallet_debit"]);

function normalizePreview(payload: any): PreviewData | null {
  if (!payload || payload.error) return null;
  const credits = Array.isArray(payload.credits) ? payload.credits : [];
  if (credits.length === 0) return null;
  return {
    credits,
    grossAmount: Number(payload.grossAmount || 0),
    creditsCount: Number(payload.creditsCount ?? credits.length),
    totalFee: Number(payload.totalFee || 0),
    netAmount: Number(payload.netAmount || 0),
    message: payload.message,
  };
}

function getTransactionLabel(type: string, description: string | null) {
  if (type === "refund") return "Cancelamento PIX";
  if (type === "withdraw") return "Reembolso PIX";
  if (type === "payment") return "Pagamento";
  if (type === "recharge") return "Recarga";
  if (type === "convert_credits") return "Crédito convertido";
  return description || type;
}

function getRefundMessage(preview: PreviewData) {
  return `Você vai receber ${brl(preview.netAmount)} via Pix. Será descontada a taxa real da Woovi de ${brl(preview.totalFee)} (${preview.creditsCount} cancelamento${preview.creditsCount > 1 ? "s" : ""}).`;
}


function TransactionItem({ tx, index }: { tx: WalletTransaction; index: number }) {
  const isOut = moneyOutTypes.has(tx.type);
  const isIn = moneyInTypes.has(tx.type) || !isOut;
  const isPending = tx.status === "pending";
  const isFailed = tx.status === "failed";
  const Icon = isOut ? ArrowUpRight : ArrowDownLeft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 py-3.5 border-b border-border/40 last:border-b-0"
    >
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className={cn("w-4 h-4", isIn ? "text-success" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {getTransactionLabel(tx.type, tx.description)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            isFailed && "line-through text-destructive",
            !isFailed && isIn && "text-success",
            !isFailed && isOut && "text-muted-foreground",
          )}
        >
          {isOut ? "-" : "+"}{brl(Math.abs(Number(tx.amount || 0)))}
        </p>
        {isPending && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pendente</span>}
        {isFailed && <span className="text-[10px] uppercase tracking-wider text-destructive">Falhou</span>}
      </div>
    </motion.div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm tabular-nums text-foreground", strong && "font-bold")}>{value}</span>
    </div>
  );
}

export default function ClienteCarteira() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [view, setView] = useState<View>("home");
  const [pixKey, setPixKey] = useState("");
  const [result, setResult] = useState<RefundResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        navigate("/auth?mode=login");
        return;
      }

      const [profileRes, balanceRes, txRes, previewRes] = await Promise.all([
        supabase.from("profiles").select("nome, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.functions.invoke("wallet-operations", { body: { action: "get_balance" } }),
        supabase.functions.invoke("wallet-operations", { body: { action: "get_transactions" } }),
        supabase.functions.invoke("woovi-client-refund", { body: { action: "preview" } }),
      ]);

      const loadedTransactions = Array.isArray(txRes.data?.transactions) ? txRes.data.transactions : [];
      setProfile(profileRes.data || null);
      setBalance(Number(balanceRes.data?.balance || 0));
      setTransactions(loadedTransactions);
      setPreview(normalizePreview(previewRes.data));

    } catch (error) {
      console.error("Erro ao carregar carteira:", error);
      toast.error("Não foi possível carregar sua carteira.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = useMemo(() => {
    return transactions.reduce(
      (acc, tx) => {
        const amount = Math.abs(Number(tx.amount || 0));
        if (tx.status === "failed") return acc;
        if (moneyOutTypes.has(tx.type)) acc.out += amount;
        else acc.in += amount;
        return acc;
      },
      { in: 0, out: 0 },
    );
  }, [transactions]);

  const hasRefundCredits = Boolean(preview && preview.creditsCount > 0 && preview.grossAmount > 0);

  const confirmRefund = async () => {
    if (!preview || !hasRefundCredits) {
      toast.info("Você não tem créditos de cancelamento disponíveis.");
      return;
    }
    if (!pixKey.trim() || pixKey.trim().length < 5) {
      toast.error("Informe uma chave Pix válida.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-operations", {
        body: { action: "withdraw", confirmed: true, pixKey: pixKey.trim() },
      });

      if (error || data?.error || !data?.success) {
        throw new Error(data?.error || error?.message || "Falha ao solicitar reembolso.");
      }

      setResult(data as RefundResult);
      setView("success");
      toast.success("Reembolso solicitado com sucesso.");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro inesperado ao solicitar reembolso.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background overflow-hidden">
      <div className="relative shrink-0 bg-primary text-primary-foreground pt-[calc(env(safe-area-inset-top)+1rem)] pb-24 overflow-hidden">
        <div className="relative z-10 px-4">
          <div className="flex items-center justify-between mb-7">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-foreground/10 border border-primary-foreground/15 active:scale-95 transition-transform"
              aria-label="Voltar"
            >
              <BackArrow size={19} className="text-primary-foreground" />
            </motion.button>
            <h1 className="text-base font-bold text-primary-foreground">Carteira</h1>
            <button
              onClick={loadData}
              disabled={loading}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary-foreground/10 border border-primary-foreground/15 disabled:opacity-60"
              aria-label="Atualizar carteira"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary-foreground text-primary flex items-center justify-center shadow-soft overflow-hidden">
              {profile?.avatar_url ? (
                <img
                  src={supabase.storage.from("avatars").getPublicUrl(profile.avatar_url).data.publicUrl}
                  alt="Foto do cliente"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-primary-foreground/70 font-semibold">Olá</p>
              <p className="text-lg font-bold text-primary-foreground truncate">{firstName(profile?.nome)}</p>
            </div>
          </motion.div>
        </div>
        <svg className="absolute -bottom-px left-0 w-full h-16" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 14 C95 62 295 62 400 14 L400 64 L0 64 Z" fill="hsl(var(--background))" />
        </svg>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-24 -mt-16 relative z-10">
        <AnimatePresence mode="wait">
          {view === "home" && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <section className="rounded-lg bg-card border border-border shadow-premium p-4 active:scale-[0.99] transition-transform">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Saldo na carteira</p>
                    <div className="text-3xl font-bold tabular-nums text-foreground">
                      {loading ? "—" : balanceVisible ? brl(balance) : "R$ ••••"}
                    </div>
                  </div>
                  <button
                    onClick={() => setBalanceVisible((visible) => !visible)}
                    className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground active:scale-95 transition-transform"
                    aria-label={balanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
                  >
                    {balanceVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-4">
                  <div className="rounded-lg bg-muted/60 border border-border/60 p-3">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Você recebe</p>
                    <p className="text-base font-bold tabular-nums text-success">{brl(preview?.netAmount || 0)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 border border-border/60 p-3">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Taxas</p>
                    <p className="text-base font-bold tabular-nums text-foreground">{brl(preview?.totalFee || 0)}</p>
                  </div>
                </div>

                <Button
                  onClick={() => setView("confirm")}
                  disabled={!hasRefundCredits || loading}
                  className="w-full h-11 rounded-lg font-bold"
                >
                  Solicitar reembolso
                </Button>
              </section>

              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <div className="rounded-lg bg-card border border-border p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-success" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Entradas</span>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-foreground">{brl(totals.in)}</p>
                </div>
                <div className="rounded-lg bg-card border border-border p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Saídas</span>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-foreground">{brl(totals.out)}</p>
                </div>
              </div>

              <section className="mt-6">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h2 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Créditos de cancelamento</h2>
                  {hasRefundCredits && <span className="text-[10px] text-muted-foreground tabular-nums">{preview!.creditsCount}</span>}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : !hasRefundCredits ? (
                  <div className="rounded-lg bg-card border border-border p-5 text-center">
                    <Wallet className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Nenhum crédito disponível</p>
                    <p className="text-xs text-muted-foreground mt-1">Cancelamentos Pix aparecem aqui com crédito integral.</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-card border border-border overflow-hidden">
                    {preview!.credits.map((credit, index) => (
                      <motion.div
                        key={credit.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn("p-3.5", index > 0 && "border-t border-border/50")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {credit.description?.replace(/^Estorno de cancelamento\s*/i, "Cancelamento") || "Cancelamento PIX"}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {format(new Date(credit.created_at), "dd MMM yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-success tabular-nums shrink-0">+{brl(credit.amount)}</p>
                        </div>
                        <div className="mt-2 inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                          Taxa no reembolso: {brl(credit.fee)}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-6">
                <h2 className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground mb-2 px-1">Extrato</h2>
                <div className="rounded-lg bg-card border border-border overflow-hidden">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="p-5 text-center">
                      <Receipt className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">Nenhuma movimentação</p>
                    </div>
                  ) : (
                    transactions.map((tx, index) => <TransactionItem key={tx.id} tx={tx} index={index} />)
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {view === "confirm" && preview && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <button
                onClick={() => setView("home")}
                className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-foreground active:scale-95 transition-transform"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>

              <section className="rounded-lg bg-card border border-border shadow-premium p-4">
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">Confirmar reembolso</h2>
                <p className="text-sm leading-relaxed text-muted-foreground mb-4">{getRefundMessage(preview)}</p>

                <div className="rounded-lg bg-muted/60 border border-border/60 p-3 mb-4">
                  <SummaryRow label="Crédito total" value={brl(preview.grossAmount)} />
                  <SummaryRow label="Cancelamentos" value={`${preview.creditsCount}`} />
                  <SummaryRow label="Taxa de processamento" value={`- ${brl(preview.totalFee)}`} />
                  <div className="h-px bg-border/60 my-1" />
                  <SummaryRow label="Valor líquido" value={brl(preview.netAmount)} strong />
                </div>

                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2 block">
                  Chave Pix para receber
                </label>
                <Input
                  value={pixKey}
                  onChange={(event) => setPixKey(event.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  className="h-11 rounded-lg mb-3"
                />
                <div className="flex items-start gap-2 text-xs text-muted-foreground mb-5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-success shrink-0" />
                  <span>O valor líquido será enviado via Pix após a confirmação.</span>
                </div>

                <Button onClick={confirmRefund} disabled={submitting} className="w-full h-11 rounded-lg font-bold">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Confirmar reembolso
                </Button>
              </section>
            </motion.div>
          )}

          {view === "success" && (
            <motion.div key="success" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <section className="rounded-lg bg-card border border-border shadow-premium p-5 text-center">
                <div className="w-14 h-14 rounded-lg bg-success/10 text-success mx-auto flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-bold text-foreground mb-2">Reembolso solicitado</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  {result
                    ? `Você vai receber ${brl(result.netAmount)} via Pix. Taxa descontada: ${brl(result.totalFee)}.`
                    : "Sua solicitação foi enviada para processamento."}
                </p>
                <Button onClick={() => setView("home")} className="w-full h-11 rounded-lg font-bold">
                  Voltar para carteira
                </Button>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {!loading && !preview && view === "confirm" && (
          <div className="rounded-lg bg-card border border-border p-5 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Nenhum crédito disponível</p>
          </div>
        )}
      </div>
    </div>
  );
}
