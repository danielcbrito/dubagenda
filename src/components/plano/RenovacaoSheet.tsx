import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, QrCode, Banknote, CreditCard, Loader2, X, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type Step = "escolha" | "pix" | "confirmacao";
type FormaPagamento = "pix" | "cartao" | "dinheiro";

interface RenovacaoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assinaturaId: string;
  planoNome: string;
  planoPreco: number;
  servicoNome: string;
  userId: string;
  onRenovado: () => void;
}

function PaymentOption({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all active:scale-[0.98]",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border/40 bg-card hover:border-border"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
        selected ? "bg-primary/10" : "bg-secondary/50"
      )}>
        <Icon className={cn("w-4 h-4", selected ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 text-left">
        <p className={cn("text-[13px] font-semibold", selected ? "text-foreground" : "text-foreground")}>{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <div className={cn(
        "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
        selected ? "border-primary" : "border-muted-foreground/30"
      )}>
        {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
    </button>
  );
}

export function RenovacaoSheet({
  open,
  onOpenChange,
  assinaturaId,
  planoNome,
  planoPreco,
  servicoNome,
  userId,
  onRenovado,
}: RenovacaoSheetProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("escolha");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; copia_cola: string } | null>(null);

  const newCycleEnd = format(addDays(new Date(), 30), "dd 'de' MMMM", { locale: ptBR });

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("escolha");
        setFormaPagamento(null);
        setLoading(false);
        setPixData(null);
      }, 300);
    }
  }, [open]);

  // PIX polling
  useEffect(() => {
    if (step !== "pix") return;
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc("get_assinatura_status", { p_user_id: userId });
      if (data && typeof data === "object" && "status" in (data as any)) {
        const status = (data as any).status;
        if (status === "active") {
          setStep("confirmacao");
          onRenovado();
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [step, userId, onRenovado]);

  const handleConfirm = useCallback(async () => {
    if (!formaPagamento) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("renew-subscription", {
        body: { assinaturaId, formaPagamento },
      });

      if (error) {
        const errorMsg = typeof error === "object" && "message" in error
          ? (error as any).message
          : String(error);
        throw new Error(errorMsg || "Erro ao conectar com o servidor");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (formaPagamento === "dinheiro") {
        setStep("confirmacao");
        onRenovado();
      } else if (formaPagamento === "pix") {
        setPixData({
          qr_code: data.pixQrCode,
          copia_cola: data.pixPayload,
        });
        setStep("pix");
      } else if (formaPagamento === "cartao") {
        if (data.paymentUrl) {
          window.open(data.paymentUrl, "_blank");
          toast.info("Complete o pagamento na página aberta");
          onOpenChange(false);
        }
      }
    } catch (err: any) {
      console.error("[RenovacaoSheet] Erro:", err);
      toast.error(err.message || "Erro ao renovar plano");
    } finally {
      setLoading(false);
    }
  }, [formaPagamento, assinaturaId, onRenovado, onOpenChange]);

  const handleCopyPix = useCallback(() => {
    if (pixData?.copia_cola) {
      navigator.clipboard.writeText(pixData.copia_cola);
      toast.success("Código PIX copiado!");
    }
  }, [pixData]);

  const handleClose = () => {
    if (step === "pix") {
      // Revert status if user cancels PIX
      supabase
        .from("assinaturas")
        .update({ status: "active" as any, pix_qr_code: null, pix_payload: null, asaas_payment_id: null })
        .eq("id", assinaturaId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["assinatura-status"] });
        });
    }
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto overscroll-contain pb-8">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-[15px] font-semibold text-foreground">
              {step === "escolha" && "Renovar plano"}
              {step === "pix" && "Pagar renovação via PIX"}
              {step === "confirmacao" && "Plano renovado!"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-4 space-y-5">
            <AnimatePresence mode="wait">
              {/* ─── STEP 1: ESCOLHA ─── */}
              {step === "escolha" && (
                <motion.div
                  key="escolha"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  {/* Resumo */}
                  <div className="rounded-xl bg-muted/50 p-4 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Resumo da renovação
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-[13px] text-foreground font-medium">{planoNome}</p>
                      <p className="text-[12px] text-muted-foreground">Serviço: {servicoNome}</p>
                      <p className="text-[13px] text-foreground font-semibold tabular-nums">
                        R$ {planoPreco.toFixed(2)}/mês
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Novo ciclo: hoje → {newCycleEnd}
                      </p>
                    </div>
                    <div className="mt-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 inline-block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
                        Ciclo anterior encerrado
                      </span>
                    </div>
                  </div>

                  {/* Aviso */}
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ao renovar, seu novo ciclo começa hoje e você terá 4 novos {servicoNome.toLowerCase()} disponíveis.
                  </p>

                  {/* Formas de pagamento */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Forma de pagamento
                    </p>
                    <PaymentOption
                      icon={QrCode}
                      label="PIX"
                      description="Pagamento instantâneo"
                      selected={formaPagamento === "pix"}
                      onClick={() => setFormaPagamento("pix")}
                    />
                    <PaymentOption
                      icon={CreditCard}
                      label="Cartão de crédito"
                      description="Pagamento online"
                      selected={formaPagamento === "cartao"}
                      onClick={() => setFormaPagamento("cartao")}
                    />
                    <PaymentOption
                      icon={Banknote}
                      label="Dinheiro"
                      description="Pague na barbearia"
                      selected={formaPagamento === "dinheiro"}
                      onClick={() => setFormaPagamento("dinheiro")}
                    />
                  </div>

                  {/* Botão */}
                  <Button
                    onClick={handleConfirm}
                    disabled={!formaPagamento || loading}
                    className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-[13px] font-semibold"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirmar renovação"
                    )}
                  </Button>
                </motion.div>
              )}

              {/* ─── STEP 2: PIX ─── */}
              {step === "pix" && pixData && (
                <motion.div
                  key="pix"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  {/* Valor */}
                  <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums text-foreground">
                      R$ {planoPreco.toFixed(2)}
                    </p>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="w-[200px] h-[200px] rounded-xl overflow-hidden bg-card border border-border/40 p-2">
                      <img
                        src={`data:image/png;base64,${pixData.qr_code}`}
                        alt="QR Code PIX"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Copia e cola */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-xl bg-muted/50 border border-border/30 p-3">
                      <p className="flex-1 text-[11px] text-muted-foreground truncate font-mono">
                        {pixData.copia_cola}
                      </p>
                    </div>
                    <Button
                      onClick={handleCopyPix}
                      variant="outline"
                      className="w-full h-10 rounded-xl text-[12px] gap-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copiar código PIX
                    </Button>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    Após o pagamento, seu plano será renovado automaticamente.
                  </p>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const { data } = await supabase.rpc("get_assinatura_status", { p_user_id: userId });
                        if (data && typeof data === "object" && (data as any).status === "active") {
                          setStep("confirmacao");
                          onRenovado();
                        } else {
                          toast.info("Pagamento ainda não confirmado. Aguarde alguns instantes.");
                        }
                      }}
                      className="w-full h-10 rounded-xl text-[12px]"
                    >
                      Já paguei
                    </Button>
                    <button
                      onClick={handleClose}
                      className="w-full text-center text-[12px] text-destructive py-2"
                    >
                      Cancelar
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ─── STEP 3: CONFIRMAÇÃO ─── */}
              {step === "confirmacao" && (
                <motion.div
                  key="confirmacao"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.15, 1] }}
                    transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center"
                  >
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </motion.div>

                  <div>
                    <p className="text-[15px] font-semibold text-foreground">Plano renovado!</p>
                    <p className="text-[12px] text-muted-foreground mt-1">Seu novo ciclo começa hoje</p>
                  </div>

                  {/* Resumo */}
                  <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-left">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">Serviço</span>
                      <span className="text-foreground font-medium">{servicoNome}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">Disponível</span>
                      <span className="text-foreground font-medium">4 serviços</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">Válido até</span>
                      <span className="text-foreground font-medium">{newCycleEnd}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        onOpenChange(false);
                        navigate("/cliente/agendar");
                      }}
                      className="w-full h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-[13px] font-semibold gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      Agendar agora
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="w-full h-10 rounded-xl text-[12px]"
                    >
                      Ver meu plano
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
