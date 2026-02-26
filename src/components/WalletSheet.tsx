import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Plus,
  ChevronLeft,
  Eye,
  EyeOff,
  RefreshCw,
  Gift,
  Coins,
  AlertCircle,
  ArrowDownToLine,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WalletSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
}

type TabType = "extrato" | "acoes";

/** Mapa de ícone e label por tipo de transação */
const typeMeta: Record<string, { icon: typeof Coins; label: string; color: string }> = {
  refund: { icon: RefreshCw, label: "Estorno", color: "text-green-400" },
  recharge: { icon: Plus, label: "Recarga", color: "text-blue-400" },
  payment: { icon: ArrowUpRight, label: "Pagamento", color: "text-orange-400" },
  withdraw: { icon: ArrowDownToLine, label: "Retirada", color: "text-red-400" },
  transfer: { icon: Send, label: "Transferência", color: "text-purple-400" },
  convert_credits: { icon: ArrowLeftRight, label: "Conversão", color: "text-amber-400" },
  bonus: { icon: Gift, label: "Bônus", color: "text-emerald-400" },
};

function getTypeMeta(type: string) {
  return typeMeta[type] || { icon: Coins, label: type, color: "text-muted-foreground" };
}

/* ─────────────────────── ITEM DO EXTRATO ─────────────────────── */
function TransactionItem({ tx, index }: { tx: WalletTransaction; index: number }) {
  const isPending = tx.status === "pending";
  const meta = getTypeMeta(tx.type);
  const Icon = meta.icon;
  const isDebit = ["withdraw", "transfer", "payment"].includes(tx.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "flex items-center gap-3 py-3.5 border-b border-border/40 last:border-b-0",
        isPending && "opacity-60"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
        isPending ? "bg-muted/50" : "bg-muted"
      )}>
        <Icon className={cn("w-4 h-4", isPending ? "text-muted-foreground" : meta.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          isPending ? "text-muted-foreground" : "text-foreground"
        )}>
          {tx.description || meta.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className={cn(
          "text-sm font-semibold",
          isPending ? "text-muted-foreground" :
          isDebit ? "text-red-400" : "text-green-400"
        )}>
          {isDebit ? "-" : "+"}R$ {tx.amount.toFixed(2).replace(".", ",")}
        </p>
        {isPending ? (
          <span className="text-[10px] text-amber-400">Pendente</span>
        ) : (
          <span className="text-[10px] text-green-400">Concluído</span>
        )}
      </div>
    </motion.div>
  );
}

/* ─────────────────────── BOTÃO DE AÇÃO RÁPIDA ─────────────────────── */
function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group"
    >
      <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center group-hover:bg-muted group-active:scale-95 transition-all">
        <Icon className="w-5 h-5 text-foreground" />
      </div>
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
    </button>
  );
}

/* ─────────────────────── COMPONENTE PRINCIPAL ─────────────────────── */
export function WalletSheet({ open, onOpenChange, userId }: WalletSheetProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("extrato");

  const totalEntradas = transactions
    .filter(t => !["withdraw", "transfer", "payment"].includes(t.type) && t.status === "completed")
    .reduce((acc, t) => acc + t.amount, 0);
  const totalSaidas = transactions
    .filter(t => ["withdraw", "transfer", "payment"].includes(t.type) && t.status === "completed")
    .reduce((acc, t) => acc + t.amount, 0);

  useEffect(() => {
    if (open && userId) loadWallet();
  }, [open, userId]);

  const loadWallet = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [balanceRes, txRes] = await Promise.all([
        supabase.rpc("get_or_create_wallet_balance", { p_user_id: userId }),
        supabase
          .from("wallet_transactions")
          .select("id, type, amount, status, description, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (balanceRes.error) throw balanceRes.error;
      if (txRes.error) throw txRes.error;

      setWalletBalance(balanceRes.data || 0);
      setTransactions((txRes.data as WalletTransaction[]) || []);
    } catch (error) {
      console.error("Error loading wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleComingSoon = (action: string) => {
    toast.info(`${action} estará disponível em breve`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full p-0 bg-background border-border flex flex-col"
      >
        {/* ── HEADER ── */}
        <div className="shrink-0 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-card border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
            <h2 className="text-base font-semibold text-foreground">Carteira</h2>
            <div className="w-8" />
          </div>

          {/* Saldo principal */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-muted-foreground">Saldo disponível</span>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {balanceVisible ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="text-3xl font-bold text-foreground tracking-tight">
              {balanceVisible ? (
                <>R$ {walletBalance.toFixed(2).replace(".", ",")}</>
              ) : (
                "R$ •••••"
              )}
            </div>
          </motion.div>

          {/* Ação: Recarregar */}
          <div className="flex items-center justify-center">
            <QuickAction
              icon={Plus}
              label="Recarregar"
              onClick={() => handleComingSoon("Recarga")}
            />
          </div>
        </div>

        {/* ── SEPARADOR ── */}
        <div className="h-2 bg-muted/30 shrink-0" />

        {/* ── RESUMO RÁPIDO ── */}
        <div className="shrink-0 px-5 py-4 flex gap-4">
          <div className="flex-1 bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[11px] text-muted-foreground">Entradas</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              R$ {totalEntradas.toFixed(2).replace(".", ",")}
            </p>
          </div>
          <div className="flex-1 bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Saídas</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              R$ {totalSaidas.toFixed(2).replace(".", ",")}
            </p>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="shrink-0 px-5 flex gap-1 border-b border-border">
          {(["extrato", "acoes"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium text-center transition-colors relative",
                activeTab === tab
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              {tab === "extrato" ? "Extrato" : "Informações"}
              {activeTab === tab && (
                <motion.div
                  layoutId="wallet-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* ── CONTEÚDO SCROLLÁVEL ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            {activeTab === "extrato" ? (
              <motion.div
                key="extrato"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Wallet className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Nenhuma movimentação
                    </p>
                    <p className="text-xs text-muted-foreground/70 max-w-[220px] mx-auto">
                      Estornos de cancelamentos e recargas aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="pb-6">
                    {transactions.map((tx, index) => (
                      <TransactionItem
                        key={tx.id}
                        tx={tx}
                        index={index}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="acoes"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Como funciona a carteira
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Quando um agendamento pago é cancelado, o valor é automaticamente
                    adicionado ao saldo da sua carteira. Você pode usar esse saldo
                    como forma de pagamento em novos agendamentos.
                  </p>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Estornos automáticos
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pagamentos via PIX, Cartão ou Crédito que forem cancelados
                    são convertidos automaticamente em saldo da carteira, disponível
                    para uso imediato.
                  </p>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Novas funcionalidades
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Em breve você poderá recarregar sua carteira e transferir saldo.
                    Fique ligado nas atualizações.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
