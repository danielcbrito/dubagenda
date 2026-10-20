import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  Info,
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
import { BackArrow } from "@/components/ui/back-arrow";
import { useCancellationDebt } from "@/hooks/useCancellationDebt";
import { getPendingDebtTotal, getPendingDebtItems, type CancellationDebtItem } from "@/lib/cancellation-debt";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [result, setResult] = useState<RefundResult | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const { debts: cancellationDebts, refresh: refreshDebts } = useCancellationDebt(userId ?? undefined);
  const pendingDebtTotal = useMemo(() => getPendingDebtTotal(cancellationDebts), [cancellationDebts]);
  const pendingDebtItems = useMemo(() => getPendingDebtItems(cancellationDebts), [cancellationDebts]);

  // Pix quittance modal state
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{ br_code: string; qr_code_image?: string; expires_at?: string } | null>(null);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [pixError, setPixError] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        navigate("/auth?mode=login");
        return;
      }
      setUserId(user.id);

      const [profileRes, balanceRes, txRes, previewRes] = await Promise.all([
        supabase.from("profiles").select("nome, avatar_url").eq("id", user.id).maybeSingle(),
        supabase.functions.invoke("wallet-operations", { body: { action: "get_balance" } }),
        supabase.functions.invoke("wallet-operations", { body: { action: "get_transactions" } }),
        supabase.functions.invoke("wallet-operations", { body: { action: "withdraw" } }),
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

  // Polling automático da confirmação do PIX da taxa
  useEffect(() => {
    if (!pixModalOpen || !cancellationDebts[0]) return;
    const debtRow = cancellationDebts[0];
    let disposed = false;
    const timer = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("cancellation-debt", {
          body: { action: "status", rowId: debtRow.row_id },
        });
        if (!disposed && data?.paid) {
          toast.success("Pagamento confirmado! Sua pendência foi quitada.");
          setPixModalOpen(false);
          refreshDebts();
          loadData();
        }
      } catch (err) {
        console.warn("Polling debt payment status failed:", err);
      }
    }, 8000);

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [pixModalOpen, cancellationDebts, refreshDebts, loadData]);

  const handleOpenDebtPix = async () => {
    const debtRow = cancellationDebts[0];
    if (!debtRow || generatingPix) return;
    setGeneratingPix(true);
    setPixError("");
    setPixModalOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancellation-debt", {
        body: { action: "create", rowId: debtRow.row_id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro ao gerar PIX");
      if (data?.paid) {
        toast.success("Pendência já quitada!");
        setPixModalOpen(false);
        refreshDebts();
        loadData();
        return;
      }
      setPixData(data);
    } catch (err: any) {
      setPixError(err.message || "Não foi possível gerar o código PIX.");
    } finally {
      setGeneratingPix(false);
    }
  };

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

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-operations", {
        body: { action: "withdraw", confirmed: true },
      });

      if (error || data?.error || data?.fallback || !data?.success) {
        throw new Error(data?.message || data?.error || error?.message || "Falha ao solicitar reembolso.");
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
              onClick={() => {
                if (window.history.length > 1) navigate(-1);
                else navigate("/cliente");
              }}

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
            <div className="w-11 h-11 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile?.nome ?? "Cliente"}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : profile?.nome ? (
                <span className="text-sm font-semibold uppercase">
                  {profile.nome.trim().split(/\s+/).slice(0, 2).map((n: string) => n[0]).join("")}
                </span>
              ) : (
                <UserIcon className="w-5 h-5" strokeWidth={1.75} />
              )}
            </div>
            <p className="text-base font-medium text-primary-foreground truncate">
              Olá, <span className="font-semibold">{firstName(profile?.nome)}</span>
            </p>
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
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Saldo na carteira</p>
                    <div className="text-3xl font-semibold tabular-nums text-foreground tracking-tight">
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

                <Button
                  onClick={() => setView("confirm")}
                  disabled={!hasRefundCredits || loading}
                  className="w-full h-11 rounded-lg font-medium tracking-tight"
                >
                  Solicitar reembolso
                </Button>
              </section>

              {/* Seção de Taxas e Pendências (Cancelamento / Falta) */}
              {pendingDebtTotal > 0 && (
                <section className="mt-5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/25 p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxa Pendente</p>
                        <p className="text-2xl font-bold tabular-nums text-foreground mt-0.5">
                          {brl(pendingDebtTotal)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Este valor será somado automaticamente no total do seu próximo agendamento (via Pix ou na barbearia), ou você pode regularizá-lo agora via Pix:
                  </p>

                  {/* Lista detalhada de taxas pendentes */}
                  <div className="space-y-2 pt-2 border-t border-amber-500/15">
                    {pendingDebtItems.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-center justify-between text-xs py-1">
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-foreground truncate">
                            {item.motivo === 'falta' ? 'Falta / Não comparecimento' : 'Cancelamento com menos de 2h'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.barbeiro_nome ? `Profissional: ${item.barbeiro_nome}` : 'Barbearia'}
                            {item.created_at ? ` • ${format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR })}` : ''}
                          </p>
                        </div>
                        <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400 shrink-0">
                          {brl(item.valor_taxa)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleOpenDebtPix}
                    disabled={generatingPix}
                    className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs tracking-tight transition-all"
                  >
                    {generatingPix ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando PIX...
                      </>
                    ) : (
                      "Pagar taxa agora via Pix"
                    )}
                  </Button>
                </section>
              )}



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
                  <div>
                    {preview!.credits.map((credit, index) => (
                      <motion.div
                        key={credit.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="py-3.5"
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
                  <div className="divide-y divide-border/40">

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

                <div className="flex items-start gap-2 text-xs text-muted-foreground mb-5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 text-success shrink-0" />
                  <span>O reembolso será devolvido automaticamente para a mesma conta usada no pagamento original via Pix.</span>
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

      {/* Modal de Quitação de Taxa Pendente via PIX */}
      <Dialog open={pixModalOpen} onOpenChange={setPixModalOpen}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl border-border bg-background p-6">
          <DialogHeader className="text-center space-y-1.5">
            <DialogTitle className="text-lg font-bold text-foreground">
              Pagar Taxa Pendente via Pix
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Escaneie o QR Code ou copie o código Pix abaixo para quitar sua pendência.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-center">
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {brl(pendingDebtTotal)}
            </p>

            {generatingPix && (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs">Gerando QR Code PIX...</p>
              </div>
            )}

            {pixError && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                {pixError}
              </div>
            )}

            {pixData && !generatingPix && (
              <>
                {pixData.qr_code_image && (
                  <div className="p-3 bg-white rounded-xl inline-block mx-auto border border-border shadow-sm">
                    <img
                      src={pixData.qr_code_image.startsWith("data:") ? pixData.qr_code_image : `data:image/png;base64,${pixData.qr_code_image}`}
                      alt="QR Code Pix"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                )}

                <Button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pixData.br_code);
                      setCopiedPix(true);
                      toast.success("Código PIX copiado!");
                      setTimeout(() => setCopiedPix(false), 3000);
                    } catch {
                      toast.error("Erro ao copiar código PIX.");
                    }
                  }}
                  variant="outline"
                  className="w-full h-11 rounded-xl text-xs font-semibold gap-2"
                >
                  {copiedPix ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copiedPix ? "Código PIX Copiado!" : "Copiar Código Pix Copia e Cola"}
                </Button>

                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  Aguardando confirmação do pagamento...
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
