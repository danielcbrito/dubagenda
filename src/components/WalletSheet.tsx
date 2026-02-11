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

interface Credit {
  id: string;
  valor: number;
  origem: string;
  usado: boolean;
  created_at: string;
  expires_at: string | null;
  agendamento_origem_id: string | null;
}

type TabType = "extrato" | "acoes";

/** Mapa de ícone e label por origem do crédito */
const originMeta: Record<string, { icon: typeof Coins; label: string; color: string }> = {
  cancelamento: { icon: RefreshCw, label: "Cancelamento", color: "text-blue-400" },
  reembolso: { icon: ArrowDownLeft, label: "Reembolso", color: "text-orange-400" },
  promocao: { icon: Gift, label: "Promoção", color: "text-purple-400" },
};

function getOriginMeta(origem: string) {
  return originMeta[origem] || { icon: Coins, label: origem, color: "text-muted-foreground" };
}

/* ─────────────────────── ITEM DO EXTRATO ─────────────────────── */
function TransactionItem({ credito, index }: { credito: Credit; index: number }) {
  const isUsed = credito.usado;
  const isExpired = credito.expires_at && new Date(credito.expires_at) < new Date();
  const inactive = isUsed || !!isExpired;
  const meta = getOriginMeta(credito.origem);
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "flex items-center gap-3 py-3.5 border-b border-border/40 last:border-b-0",
        inactive && "opacity-50"
      )}
    >
      {/* Ícone circular */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
        inactive ? "bg-muted/50" : "bg-muted"
      )}>
        <Icon className={cn("w-4 h-4", inactive ? "text-muted-foreground" : meta.color)} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          inactive ? "text-muted-foreground" : "text-foreground"
        )}>
          {meta.label}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(credito.created_at), "dd MMM yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Valor + status */}
      <div className="text-right shrink-0">
        <p className={cn(
          "text-sm font-semibold",
          inactive ? "text-muted-foreground line-through" : "text-green-400"
        )}>
          +R$ {credito.valor.toFixed(2).replace(".", ",")}
        </p>
        {isUsed ? (
          <span className="text-[10px] text-muted-foreground">Utilizado</span>
        ) : isExpired ? (
          <span className="text-[10px] text-destructive flex items-center justify-end gap-0.5">
            <AlertCircle className="w-2.5 h-2.5" /> Expirado
          </span>
        ) : (
          <span className="text-[10px] text-green-400">Disponível</span>
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
  const [credits, setCredits] = useState<Credit[]>([]);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("extrato");

  const totalRecebido = credits.reduce((acc, c) => acc + c.valor, 0);
  const totalUtilizado = credits.filter((c) => c.usado).reduce((acc, c) => acc + c.valor, 0);

  useEffect(() => {
    if (open && userId) loadCredits();
  }, [open, userId]);

  const loadCredits = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [creditsRes, balanceRes] = await Promise.all([
        supabase
          .from("creditos")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase.rpc("get_user_available_credits", { p_user_id: userId }),
      ]);

      if (creditsRes.error) throw creditsRes.error;
      if (balanceRes.error) throw balanceRes.error;

      setCredits(creditsRes.data || []);
      setAvailableBalance(balanceRes.data || 0);
    } catch (error) {
      console.error("Error loading credits:", error);
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
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-card border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
            <h2 className="text-base font-semibold text-foreground">Carteira</h2>
            <div className="w-8" /> {/* spacer */}
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
                <>R$ {availableBalance.toFixed(2).replace(".", ",")}</>
              ) : (
                "R$ •••••"
              )}
            </div>
          </motion.div>

          {/* Ações rápidas */}
          <div className="flex items-center justify-around">
            <QuickAction
              icon={Plus}
              label="Recarregar"
              onClick={() => handleComingSoon("Recarga")}
            />
            <QuickAction
              icon={ArrowDownToLine}
              label="Retirar"
              onClick={() => handleComingSoon("Retirada")}
            />
            <QuickAction
              icon={Send}
              label="Transferir"
              onClick={() => handleComingSoon("Transferência")}
            />
            <QuickAction
              icon={ArrowLeftRight}
              label="Converter"
              onClick={() => handleComingSoon("Conversão")}
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
              <span className="text-[11px] text-muted-foreground">Recebido</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              R$ {totalRecebido.toFixed(2).replace(".", ",")}
            </p>
          </div>
          <div className="flex-1 bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Utilizado</span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              R$ {totalUtilizado.toFixed(2).replace(".", ",")}
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
                ) : credits.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Wallet className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Nenhuma movimentação
                    </p>
                    <p className="text-xs text-muted-foreground/70 max-w-[220px] mx-auto">
                      Seus créditos de cancelamentos, reembolsos e promoções aparecerão aqui
                    </p>
                  </div>
                ) : (
                  <div className="pb-6">
                    {credits.map((credito, index) => (
                      <TransactionItem
                        key={credito.id}
                        credito={credito}
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
                {/* Cards informativos */}
                <div className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Como funcionam os créditos
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Créditos são gerados automaticamente quando um agendamento pago é cancelado
                    ou quando você participa de promoções. Eles podem ser usados como forma
                    de pagamento em novos agendamentos.
                  </p>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Validade dos créditos
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Os créditos possuem validade definida no momento da emissão. Créditos
                    expirados não podem ser utilizados. Fique atento às datas no seu extrato.
                  </p>
                </div>

                <div className="bg-card rounded-xl p-4 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Novas funcionalidades
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Em breve você poderá recarregar sua carteira, transferir saldo e
                    converter créditos. Fique ligado nas atualizações.
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
