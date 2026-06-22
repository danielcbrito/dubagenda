import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  X,
  Bell,
  Eye,
  EyeOff,
  ArrowDownToLine,
  Receipt,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WalletSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  profile?: { nome?: string | null } | null;
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
  message: string;
}


interface RefundResult {
  creditsProcessed: number;
  grossAmount: number;
  totalFee: number;
  netAmount: number;
  message: string;
}

const COLORS = {
  red: "#E10600",
  redDark: "#B30500",
  yellow: "#F5D000",
  ink: "#0F0F12",
  inkSoft: "#5E5E66",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  divider: "#E5E7EB",
  surface: "#F6F7FB",
};

type View = "home" | "confirm" | "success";

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "Cliente";

function buildPreviewFromTransactions(transactions: any[]): PreviewData | null {
  const feePerCredit = 0.5;
  const credits = transactions
    .filter((tx) => tx.type === "refund" && tx.status === "completed" && Boolean(tx.metadata?.woovi_endToEndId))
    .map((tx) => ({
      id: tx.id,
      description: tx.description || "Cancelamento PIX",
      amount: Number(tx.amount || 0),
      fee: feePerCredit,
      net: Number((Number(tx.amount || 0) - feePerCredit).toFixed(2)),
      created_at: tx.created_at,
    }));

  if (credits.length === 0) return null;
  const grossAmount = Number(credits.reduce((sum, credit) => sum + credit.amount, 0).toFixed(2));
  const totalFee = Number((credits.length * feePerCredit).toFixed(2));
  const netAmount = Number(Math.max(0, grossAmount - totalFee).toFixed(2));

  return {
    credits,
    grossAmount,
    feePerCredit,
    creditsCount: credits.length,
    totalFee,
    netAmount,
    message: "",
  };
}

export function WalletSheet({ open, onOpenChange, userId, profile }: WalletSheetProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(0);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [view, setView] = useState<View>("home");
  const [pixKey, setPixKey] = useState("");
  const [result, setResult] = useState<RefundResult | null>(null);

  useEffect(() => {
    if (open && userId) load();
    if (!open) {
      setView("home");
      setResult(null);
      setPixKey("");
    }
  }, [open, userId]);

  const load = async () => {
    setLoading(true);
    try {
      const [bal, txRes] = await Promise.all([
        supabase.rpc("get_or_create_wallet_balance", { p_user_id: userId! }),
        supabase.functions.invoke("wallet-operations", { body: { action: "get_transactions" } }),
      ]);
      setBalance(Number(bal.data || 0));
      setPreview(buildPreviewFromTransactions(txRes.data?.transactions || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startConfirm = () => {
    if (!preview || preview.creditsCount === 0) {
      toast.info("Você não tem cancelamentos PIX disponíveis para reembolso.");
      return;
    }
    setView("confirm");
  };

  const confirmRefund = async () => {
    if (!pixKey.trim() || pixKey.trim().length < 5) {
      toast.error("Informe uma chave Pix válida.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-operations", {
        body: { action: "withdraw", confirmed: true, pixKey: pixKey.trim() },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Falha ao processar reembolso.");
        return;
      }
      setResult(data as RefundResult);
      setView("success");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasCredits = (preview?.creditsCount || 0) > 0;
  const displayBalance = balance;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-screen w-screen max-w-none p-0 border-0 overflow-hidden flex flex-col"
        style={{ background: COLORS.surface }}
      >
        {/* ── Topo vermelho com curva ── */}
        <div className="relative shrink-0" style={{ background: COLORS.red, height: 230 }}>
          <svg
            className="absolute bottom-[-1px] left-0 w-full"
            viewBox="0 0 400 60"
            preserveAspectRatio="none"
            style={{ height: 60 }}
          >
            <path d="M0,0 C120,60 280,60 400,0 L400,60 L0,60 Z" fill={COLORS.surface} />
          </svg>

          {/* Header */}
          <div className="relative z-10 px-5 pt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "white" }}
              >
                <UserIcon className="w-5 h-5" style={{ color: COLORS.red }} />
              </div>
              <div>
                <p className="text-white/80 text-xs">Olá,</p>
                <p className="text-white font-semibold text-base leading-tight">
                  {firstName(profile?.nome)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Notificações"
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <Bell className="w-4 h-4 text-white" />
              </button>
              <button
                aria-label="Fechar"
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Conteúdo ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-10 -mt-16 relative z-10">
          <AnimatePresence mode="wait">
            {view === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {/* Card de saldo */}
                <div
                  className="rounded-2xl p-5 shadow-sm"
                  style={{ background: "white" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>
                      Saldo disponível
                    </span>
                    <button
                      onClick={() => setBalanceVisible((v) => !v)}
                      className="w-7 h-7 flex items-center justify-center rounded-full"
                      style={{ background: COLORS.surface }}
                    >
                      {balanceVisible ? (
                        <Eye className="w-3.5 h-3.5" style={{ color: COLORS.inkSoft }} />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" style={{ color: COLORS.inkSoft }} />
                      )}
                    </button>
                  </div>
                  <div className="text-3xl font-bold tabular-nums" style={{ color: COLORS.ink }}>
                    {loading ? "—" : balanceVisible ? brl(displayBalance) : "R$ ••••"}
                  </div>
                  {hasCredits && (
                    <p className="text-xs mt-1.5" style={{ color: COLORS.inkSoft }}>
                      {preview!.creditsCount} cancelamento{preview!.creditsCount > 1 ? "s" : ""} ·
                      Aguardando reembolso
                    </p>
                  )}

                  <div className="h-px my-4" style={{ background: COLORS.divider }} />

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={startConfirm}
                      disabled={!hasCredits || loading}
                      className="rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 text-white disabled:opacity-50"
                      style={{ background: COLORS.red }}
                    >
                      <ArrowDownToLine className="w-4 h-4" />
                      Solicitar Reembolso
                    </button>
                    <button
                      onClick={() => toast.info("Extrato em breve.")}
                      className="rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5"
                      style={{ background: COLORS.surface, color: COLORS.ink }}
                    >
                      <Receipt className="w-4 h-4" />
                      Extrato
                    </button>
                  </div>
                </div>

                {/* Lista de créditos */}
                <div className="mt-5">
                  <h3
                    className="text-[11px] uppercase tracking-widest font-semibold mb-2 px-1"
                    style={{ color: COLORS.inkSoft }}
                  >
                    Créditos pendentes
                  </h3>

                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: COLORS.red }} />
                    </div>
                  ) : !hasCredits ? (
                    <div
                      className="rounded-2xl p-5 text-center"
                      style={{ background: "white" }}
                    >
                      <AlertCircle
                        className="w-8 h-8 mx-auto mb-2"
                        style={{ color: COLORS.inkSoft }}
                      />
                      <p className="text-sm" style={{ color: COLORS.ink }}>
                        Você não tem saldo na carteira.
                      </p>
                      <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
                        Créditos aparecem aqui quando você cancela um agendamento pago via Pix.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden" style={{ background: "white" }}>
                      {preview!.credits.map((c, i) => (
                        <div
                          key={c.id}
                          className={cn(
                            "p-4 flex items-start justify-between gap-3",
                            i > 0 && "border-t",
                          )}
                          style={i > 0 ? { borderColor: COLORS.divider } : undefined}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>
                              {c.description.replace(/^Estorno de cancelamento\s*/i, "Cancelamento")}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: COLORS.inkSoft }}>
                              {format(new Date(c.created_at), "dd MMM yyyy", { locale: ptBR })}
                            </p>
                            <span
                              className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{ background: COLORS.surface, color: COLORS.inkSoft }}
                            >
                              Taxa no reembolso: {brl(c.fee)}
                            </span>
                          </div>
                          <p
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: COLORS.green }}
                          >
                            +{brl(c.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === "confirm" && preview && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <button
                  onClick={() => setView("home")}
                  className="flex items-center gap-1 mb-3 text-sm font-medium"
                  style={{ color: COLORS.ink }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </button>

                {/* Resumo */}
                <div className="rounded-2xl p-5" style={{ background: "white" }}>
                  <h3 className="text-base font-semibold mb-3" style={{ color: COLORS.ink }}>
                    Resumo do reembolso
                  </h3>
                  <Row label="Saldo na carteira" value={brl(preview.grossAmount)} />
                  <Row
                    label="Nº de cancelamentos"
                    value={`${preview.creditsCount}`}
                  />
                  <Row
                    label="Taxa por cancelamento"
                    value={`- ${brl(preview.feePerCredit)}`}
                  />
                  <Row label="Total de taxas" value={`- ${brl(preview.totalFee)}`} />
                  <div className="h-px my-3" style={{ background: COLORS.divider }} />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                      Você vai receber
                    </span>
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: COLORS.green }}
                    >
                      {brl(preview.netAmount)}
                    </span>
                  </div>
                </div>

                {/* Detalhamento */}
                <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: "white" }}>
                  <div className="p-4 pb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-widest"
                        style={{ color: COLORS.inkSoft }}>
                      Por cancelamento
                    </h4>
                  </div>
                  {preview.credits.map((c, i) => (
                    <div
                      key={c.id}
                      className={cn("p-4", i > 0 && "border-t")}
                      style={i > 0 ? { borderColor: COLORS.divider } : undefined}
                    >
                      <p className="text-sm font-medium mb-1.5" style={{ color: COLORS.ink }}>
                        {c.description.replace(/^Estorno de cancelamento\s*/i, "Cancelamento")}
                      </p>
                      <Row label="Valor bruto" value={brl(c.amount)} small />
                      <Row label="Taxa" value={`- ${brl(c.fee)}`} small />
                      <Row label="Líquido" value={`= ${brl(c.net)}`} small bold />
                    </div>
                  ))}
                </div>

                {/* Chave Pix */}
                <div className="mt-4 rounded-2xl p-5" style={{ background: "white" }}>
                  <h4 className="text-sm font-semibold mb-2" style={{ color: COLORS.ink }}>
                    Chave Pix para receber
                  </h4>
                  <input
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none border"
                    style={{
                      background: COLORS.surface,
                      borderColor: COLORS.divider,
                      color: COLORS.ink,
                    }}
                  />
                  <p className="text-[11px] mt-2" style={{ color: COLORS.inkSoft }}>
                    O reembolso será enviado para esta chave Pix. Verifique se está correta antes
                    de confirmar.
                  </p>
                </div>

                <button
                  onClick={confirmRefund}
                  disabled={submitting}
                  className="w-full mt-5 rounded-xl py-4 font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: COLORS.red }}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Confirmar reembolso de {brl(preview.netAmount)}
                </button>
              </motion.div>
            )}

            {view === "success" && result && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl p-7 text-center mt-4"
                style={{ background: "white" }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: COLORS.greenSoft }}
                >
                  <CheckCircle2 className="w-8 h-8" style={{ color: COLORS.green }} />
                </div>
                <h3 className="text-lg font-bold mb-1" style={{ color: COLORS.ink }}>
                  Reembolso solicitado!
                </h3>
                <p className="text-3xl font-bold tabular-nums mb-3" style={{ color: COLORS.green }}>
                  {brl(result.netAmount)}
                </p>
                <p className="text-sm" style={{ color: COLORS.inkSoft }}>
                  O valor será transferido para a sua chave Pix em até 1 hora.
                </p>
                <p className="text-xs mt-2" style={{ color: COLORS.inkSoft }}>
                  Taxa descontada: {brl(result.totalFee)} ({result.creditsProcessed}
                  &nbsp;cancelamento{result.creditsProcessed > 1 ? "s" : ""})
                </p>
                <button
                  onClick={() => setView("home")}
                  className="w-full mt-6 rounded-xl py-3 font-semibold"
                  style={{ background: COLORS.surface, color: COLORS.ink }}
                >
                  Voltar para a carteira
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  small,
  bold,
}: {
  label: string;
  value: string;
  small?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={cn(small ? "text-xs" : "text-sm")}
        style={{ color: COLORS.inkSoft }}
      >
        {label}
      </span>
      <span
        className={cn("tabular-nums", small ? "text-xs" : "text-sm", bold && "font-semibold")}
        style={{ color: COLORS.ink }}
      >
        {value}
      </span>
    </div>
  );
}
