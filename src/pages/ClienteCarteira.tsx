import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Plus,
  ArrowDownToLine,
  Send,
  ArrowLeftRight,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Gift,
  Coins,
  AlertCircle,
  X,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ═══════ TYPES ═══════ */
interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  gateway_payment_id: string | null;
  pix_qr_code: string | null;
  pix_payload: string | null;
  pix_expires_at: string | null;
  destination_pix_key: string | null;
  destination_name: string | null;
}

type ModalType = "recharge" | "withdraw" | "transfer" | "convert" | "pix_qr" | null;

/* ═══════ HELPER: Ícone por tipo de transação ═══════ */
const txMeta: Record<string, { icon: typeof Coins; label: string; color: string; sign: string }> = {
  recharge: { icon: Plus, label: "Recarga", color: "text-green-400", sign: "+" },
  withdraw: { icon: ArrowDownToLine, label: "Retirada", color: "text-orange-400", sign: "-" },
  transfer: { icon: Send, label: "Transferência", color: "text-blue-400", sign: "-" },
  convert_credits: { icon: ArrowLeftRight, label: "Conversão", color: "text-purple-400", sign: "+" },
  payment: { icon: ArrowUpRight, label: "Pagamento", color: "text-muted-foreground", sign: "-" },
};

function getTxMeta(type: string) {
  return txMeta[type] || { icon: Coins, label: type, color: "text-muted-foreground", sign: "" };
}

/* ═══════ TRANSACTION ITEM ═══════ */
function TransactionItem({ tx, index }: { tx: WalletTransaction; index: number }) {
  const meta = getTxMeta(tx.type);
  const Icon = meta.icon;
  const isPending = tx.status === "pending";
  const isFailed = tx.status === "failed";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 py-3.5 border-b border-border/40 last:border-b-0"
    >
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className={cn("w-4 h-4", meta.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{meta.label}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-semibold", isFailed ? "text-destructive line-through" : meta.color)}>
          {meta.sign}R$ {tx.amount.toFixed(2).replace(".", ",")}
        </p>
        {isPending && <span className="text-[10px] text-yellow-400">Pendente</span>}
        {isFailed && <span className="text-[10px] text-destructive">Falhou</span>}
      </div>
    </motion.div>
  );
}

/* ═══════ QUICK ACTION BUTTON ═══════ */
function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center group-hover:bg-muted group-active:scale-95 transition-all">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </button>
  );
}

/* ═══════ MODAL OVERLAY ═══════ */
function ModalOverlay({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80">
              <X className="w-4 h-4" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════ MAIN PAGE ═══════ */
export default function ClienteCarteira() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPixKey, setWithdrawPixKey] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferPixKey, setTransferPixKey] = useState("");
  const [transferName, setTransferName] = useState("");
  const [convertAmount, setConvertAmount] = useState("");

  // PIX QR state
  const [pixQr, setPixQr] = useState<{ qrCode: string; payload: string; transactionId: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      } else {
        navigate("/auth?mode=login");
      }
    });
  }, [navigate]);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [balanceRes, txRes] = await Promise.all([
        supabase.functions.invoke("wallet-operations", { body: { action: "get_balance" } }),
        supabase.functions.invoke("wallet-operations", { body: { action: "get_transactions" } }),
      ]);

      if (balanceRes.data) {
        setBalance(balanceRes.data.balance || 0);
        setCreditsBalance(balanceRes.data.creditsBalance || 0);
      }
      if (txRes.data) {
        setTransactions(txRes.data.transactions || []);
      }
    } catch (err) {
      console.error("Error loading wallet:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadData();
  }, [userId, loadData]);

  /* ─── RECHARGE ─── */
  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount.replace(",", "."));
    if (isNaN(amount) || amount < 1) {
      toast.error("Valor mínimo é R$ 1,00");
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-operations", {
        body: { action: "recharge", amount },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setPixQr({
        qrCode: data.pixQrCode,
        payload: data.pixPayload,
        transactionId: data.transactionId,
      });
      setActiveModal("pix_qr");
      setRechargeAmount("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar recarga");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── WITHDRAW ─── */
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount.replace(",", "."));
    if (isNaN(amount) || amount < 5) {
      toast.error("Valor mínimo é R$ 5,00");
      return;
    }
    if (!withdrawPixKey.trim()) {
      toast.error("Informe sua chave PIX");
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-operations", {
        body: { action: "withdraw", amount, pixKey: withdrawPixKey },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(data.message || "Retirada solicitada");
      setActiveModal(null);
      setWithdrawAmount("");
      setWithdrawPixKey("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar retirada");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── TRANSFER ─── */
  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount.replace(",", "."));
    if (isNaN(amount) || amount < 1) {
      toast.error("Valor mínimo é R$ 1,00");
      return;
    }
    if (!transferPixKey.trim()) {
      toast.error("Informe a chave PIX do destinatário");
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-operations", {
        body: { action: "transfer", amount, pixKey: transferPixKey, recipientName: transferName },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(data.message || "Transferência solicitada");
      setActiveModal(null);
      setTransferAmount("");
      setTransferPixKey("");
      setTransferName("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao transferir");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── CONVERT CREDITS ─── */
  const handleConvert = async () => {
    const amount = parseFloat(convertAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (amount > creditsBalance) {
      toast.error("Saldo de créditos insuficiente");
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wallet-operations", {
        body: { action: "convert_credits", amount },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`R$ ${data.convertedAmount.toFixed(2)} convertidos para saldo`);
      setActiveModal(null);
      setConvertAmount("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro na conversão");
    } finally {
      setActionLoading(false);
    }
  };

  /* ─── COPY PIX ─── */
  const handleCopyPix = () => {
    if (pixQr?.payload) {
      navigator.clipboard.writeText(pixQr.payload);
      setPixCopied(true);
      toast.success("Código PIX copiado");
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  /* ─── POLLING PIX STATUS ─── */
  useEffect(() => {
    if (activeModal !== "pix_qr" || !pixQr?.transactionId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("wallet-operations", {
          body: { action: "check_recharge_status", transactionId: pixQr.transactionId },
        });
        if (data?.status === "completed") {
          toast.success("Recarga confirmada!");
          setActiveModal(null);
          setPixQr(null);
          loadData();
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeModal, pixQr, loadData]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── HEADER ── */}
      <div className="shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/cliente")}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-card border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Carteira</h1>
          <div className="w-8" />
        </div>

        {/* Saldo principal */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">Saldo disponível</span>
            <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-muted-foreground hover:text-foreground transition-colors">
              {balanceVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-3xl font-bold text-foreground tracking-tight">
            {balanceVisible ? <>R$ {balance.toFixed(2).replace(".", ",")}</> : "R$ •••••"}
          </div>
        </motion.div>

        {/* Créditos disponíveis */}
        {creditsBalance > 0 && (
          <div className="text-xs text-muted-foreground mb-6">
            <span className="text-green-400 font-medium">R$ {creditsBalance.toFixed(2).replace(".", ",")}</span> em créditos disponíveis para conversão
          </div>
        )}

        {/* Ações rápidas */}
        <div className="flex items-center justify-around mt-4">
          <QuickAction icon={Plus} label="Recarregar" onClick={() => setActiveModal("recharge")} />
          <QuickAction icon={ArrowDownToLine} label="Retirar" onClick={() => setActiveModal("withdraw")} />
          <QuickAction icon={Send} label="Transferir" onClick={() => setActiveModal("transfer")} />
          <QuickAction icon={ArrowLeftRight} label="Converter" onClick={() => setActiveModal("convert")} />
        </div>
      </div>

      {/* Separator */}
      <div className="h-2 bg-muted/30 shrink-0" />

      {/* Summary cards */}
      <div className="shrink-0 px-5 py-4 flex gap-4">
        <div className="flex-1 bg-card rounded-xl p-3 border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[11px] text-muted-foreground">Entradas</span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            R$ {transactions.filter((t) => ["recharge", "convert_credits"].includes(t.type) && t.status === "completed").reduce((a, t) => a + t.amount, 0).toFixed(2).replace(".", ",")}
          </p>
        </div>
        <div className="flex-1 bg-card rounded-xl p-3 border border-border">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Saídas</span>
          </div>
          <p className="text-sm font-semibold text-foreground">
            R$ {transactions.filter((t) => ["withdraw", "transfer", "payment"].includes(t.type) && t.status !== "failed").reduce((a, t) => a + t.amount, 0).toFixed(2).replace(".", ",")}
          </p>
        </div>
      </div>

      {/* Extrato */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Extrato</h3>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma movimentação</p>
            <p className="text-xs text-muted-foreground/70 max-w-[220px] mx-auto">
              Suas transações aparecerão aqui
            </p>
          </div>
        ) : (
          transactions.map((tx, i) => <TransactionItem key={tx.id} tx={tx} index={i} />)
        )}
      </div>

      {/* ═══════ MODALS ═══════ */}

      {/* RECHARGE */}
      <ModalOverlay open={activeModal === "recharge"} onClose={() => setActiveModal(null)} title="Recarregar carteira">
        <p className="text-sm text-muted-foreground mb-4">Gere um QR Code PIX para adicionar saldo à sua carteira.</p>
        <label className="text-xs text-muted-foreground mb-1 block">Valor da recarga</label>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(e.target.value)}
            placeholder="0,00"
            className="text-lg font-semibold"
            inputMode="decimal"
          />
        </div>
        <div className="flex gap-2 mb-6">
          {[10, 25, 50, 100].map((v) => (
            <button
              key={v}
              onClick={() => setRechargeAmount(v.toString())}
              className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              R$ {v}
            </button>
          ))}
        </div>
        <Button onClick={handleRecharge} disabled={actionLoading} className="w-full">
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Gerar QR Code PIX
        </Button>
      </ModalOverlay>

      {/* PIX QR CODE */}
      <ModalOverlay open={activeModal === "pix_qr"} onClose={() => { setActiveModal(null); setPixQr(null); }} title="Pagar com PIX">
        {pixQr && (
          <div className="text-center">
            {pixQr.qrCode && (
              <div className="bg-white rounded-xl p-4 inline-block mb-4">
                <img src={`data:image/png;base64,${pixQr.qrCode}`} alt="QR Code PIX" className="w-48 h-48" />
              </div>
            )}
            <p className="text-xs text-muted-foreground mb-3">Escaneie o QR Code ou copie o código</p>
            <Button variant="outline" onClick={handleCopyPix} className="w-full mb-3">
              {pixCopied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
              {pixCopied ? "Copiado" : "Copiar código PIX"}
            </Button>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Aguardando pagamento...
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* WITHDRAW */}
      <ModalOverlay open={activeModal === "withdraw"} onClose={() => setActiveModal(null)} title="Retirar saldo">
        <p className="text-sm text-muted-foreground mb-4">O valor será transferido para sua conta via PIX em até 24h.</p>
        <label className="text-xs text-muted-foreground mb-1 block">Valor (min. R$ 5,00)</label>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>
        <label className="text-xs text-muted-foreground mb-1 block">Chave PIX</label>
        <Input value={withdrawPixKey} onChange={(e) => setWithdrawPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" className="mb-4" />
        <p className="text-xs text-muted-foreground mb-4">Saldo disponível: <span className="text-foreground font-medium">R$ {balance.toFixed(2).replace(".", ",")}</span></p>
        <Button onClick={handleWithdraw} disabled={actionLoading} className="w-full">
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Solicitar retirada
        </Button>
      </ModalOverlay>

      {/* TRANSFER */}
      <ModalOverlay open={activeModal === "transfer"} onClose={() => setActiveModal(null)} title="Transferir">
        <p className="text-sm text-muted-foreground mb-4">Envie saldo da sua carteira para outra conta via PIX.</p>
        <label className="text-xs text-muted-foreground mb-1 block">Valor (min. R$ 1,00)</label>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>
        <label className="text-xs text-muted-foreground mb-1 block">Nome do destinatário (opcional)</label>
        <Input value={transferName} onChange={(e) => setTransferName(e.target.value)} placeholder="Nome" className="mb-3" />
        <label className="text-xs text-muted-foreground mb-1 block">Chave PIX do destinatário</label>
        <Input value={transferPixKey} onChange={(e) => setTransferPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" className="mb-4" />
        <Button onClick={handleTransfer} disabled={actionLoading} className="w-full">
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Transferir
        </Button>
      </ModalOverlay>

      {/* CONVERT CREDITS */}
      <ModalOverlay open={activeModal === "convert"} onClose={() => setActiveModal(null)} title="Converter créditos">
        <p className="text-sm text-muted-foreground mb-4">Converta seus créditos em saldo real na carteira.</p>
        <div className="bg-muted/50 rounded-xl p-4 mb-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Créditos disponíveis</span>
            <span className="text-sm font-semibold text-green-400">R$ {creditsBalance.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>
        <label className="text-xs text-muted-foreground mb-1 block">Valor a converter</label>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">R$</span>
          <Input value={convertAmount} onChange={(e) => setConvertAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>
        <button
          onClick={() => setConvertAmount(creditsBalance.toString())}
          className="text-xs text-primary font-medium mb-4 hover:underline block"
        >
          Converter tudo
        </button>
        <Button onClick={handleConvert} disabled={actionLoading || creditsBalance <= 0} className="w-full">
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Converter para saldo
        </Button>
      </ModalOverlay>
    </div>
  );
}
