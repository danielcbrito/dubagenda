import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Clock, Info, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { useCancelAppointment } from "@/hooks/useClientMutations";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CancelAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  isPaid: boolean;
  amount: number;
  userId: string;
  onSuccess: () => void;
  paymentMethod?: string;
  observacoes?: string;
  appointmentMeta?: {
    servico?: string;
    data?: string;
    hora?: string;
    preco?: number;
    barbeiro_id?: string;
  };
}

interface QuoteState {
  id: string;
  fee: number;
  isFree: boolean;
  horasRestantes?: number;
  originalPrice: number;
  isPrepaid: boolean;
  valorPago: number;
  refundAmount: number;
  vaiDescontarReembolso: boolean;
  vaiGerarDivida: boolean;
  error: boolean;
}

const brl = (val: number) => `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`;

export function CancelAppointmentModal({
  open,
  onOpenChange,
  appointmentId,
  isPaid,
  amount,
  userId,
  onSuccess,
  paymentMethod,
  observacoes,
  appointmentMeta,
}: CancelAppointmentModalProps) {
  const { cancelAppointment, cancelling } = useCancelAppointment();
  const [quote, setQuote] = useState<QuoteState | null>(null);

  const isPaidWithCredit =
    paymentMethod === 'credit' ||
    paymentMethod === 'wallet' ||
    observacoes?.toLowerCase().includes('crédito do app') ||
    observacoes?.toLowerCase().includes('credito do app');

  const isPrepaid = isPaid || isPaidWithCredit || paymentMethod === 'pix' || paymentMethod === 'card' || paymentMethod === 'credit_card';

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setQuote(null);

    void supabase.functions
      .invoke('cancellation-debt', { body: { action: 'quote', appointmentId } })
      .then(({ data, error }) => {
        if (disposed) return;
        if (error || data?.error) {
          setQuote({
            id: appointmentId,
            fee: 0,
            isFree: false,
            originalPrice: amount,
            isPrepaid,
            valorPago: amount,
            refundAmount: isPrepaid ? amount : 0,
            vaiDescontarReembolso: false,
            vaiGerarDivida: false,
            error: true,
          });
          return;
        }

        const fee = Number(data.valor_taxa) || 0;
        const isFree = Boolean(data.is_free ?? fee === 0);
        const valorPago = Number(data.valor_pago ?? amount) || 0;
        const estimatedRefund = Number(data.valor_reembolso_estimado ?? Math.max(0, valorPago - fee));

        setQuote({
          id: appointmentId,
          fee,
          isFree,
          horasRestantes: data.horas_restantes,
          originalPrice: Number(data.valor_servico_original) || amount,
          isPrepaid: Boolean(data.is_prepaid ?? isPrepaid),
          valorPago,
          refundAmount: estimatedRefund,
          vaiDescontarReembolso: Boolean(data.vai_descontar_reembolso ?? (isPrepaid && fee > 0 && valorPago >= fee)),
          vaiGerarDivida: Boolean(data.vai_gerar_divida ?? (!isPrepaid && fee > 0)),
          error: false,
        });
      })
      .catch(() => {
        if (!disposed) {
          setQuote({
            id: appointmentId,
            fee: 0,
            isFree: false,
            originalPrice: amount,
            isPrepaid,
            valorPago: amount,
            refundAmount: isPrepaid ? amount : 0,
            vaiDescontarReembolso: false,
            vaiGerarDivida: false,
            error: true,
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, [open, appointmentId, amount, isPrepaid]);

  const quoteReady = quote?.id === appointmentId;

  const handleCancelDefinitely = () => {
    cancelAppointment({
      appointmentId,
      appointmentMeta: appointmentMeta || { preco: amount },
      onSuccess: () => {
        onSuccess();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-2xl border-border/60 bg-background p-0 overflow-hidden shadow-2xl [&>button]:w-8 [&>button]:h-8 [&>button]:top-4 [&>button]:right-4">
        {/* Header */}
        <div className="flex flex-col items-center pt-7 pb-2 px-6">
          <DialogHeader className="text-center space-y-1.5">
            <DialogTitle className="text-[19px] font-bold text-foreground tracking-tight">
              Cancelar Agendamento
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
              Tem certeza que deseja cancelar? Confira as condições de cancelamento abaixo:
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-3.5">
          {!quoteReady && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-xs">Consultando política de cancelamento...</p>
            </div>
          )}

          {quoteReady && quote.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive text-center leading-relaxed">
              Não foi possível consultar as taxas no servidor. Você pode tentar novamente em alguns instantes.
            </div>
          )}

          {quoteReady && !quote.error && (
            <>
              {/* Status do cancelamento (Gratuito vs Com Taxa) */}
              {quote.isFree ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="text-[13px] font-bold">Cancelamento Gratuito</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Você está cancelando com mais de 2 horas de antecedência. Nenhuma taxa será cobrada.
                  </p>
                  {quote.isPrepaid && quote.valorPago > 0 && (
                    <div className="pt-1.5 border-t border-emerald-500/15 flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">Reembolso na carteira:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {brl(quote.valorPago)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="text-[13px] font-bold">Cancelamento fora do prazo gratuito</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Faltam menos de 2 horas para o atendimento. A barbearia aplica uma taxa de cancelamento.
                  </p>

                  <div className="space-y-1.5 pt-1 border-t border-amber-500/15 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Valor do serviço:</span>
                      <span className="font-medium text-foreground tabular-nums">{brl(quote.originalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                      <span>Taxa de cancelamento:</span>
                      <span className="font-bold tabular-nums">− {brl(quote.fee)}</span>
                    </div>

                    {quote.isPrepaid && quote.valorPago > 0 ? (
                      <div className="flex items-center justify-between pt-1 border-t border-border/40 font-semibold text-[13px]">
                        <span className="text-foreground">Reembolso líquido:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {brl(quote.refundAmount)}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 rounded-lg bg-background/80 p-2 text-[11px] text-muted-foreground leading-relaxed">
                        A taxa de <strong>{brl(quote.fee)}</strong> será registrada como pendência e somada automaticamente ao total do seu próximo agendamento.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Botões de Ação */}
          <div className="pt-1 space-y-2">
            <Button
              onClick={handleCancelDefinitely}
              disabled={cancelling || !quoteReady || quote?.error}
              className="w-full h-[48px] rounded-xl text-[14px] font-semibold tracking-tight"
              variant="destructive"
            >
              {cancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando cancelamento...
                </>
              ) : (
                "Confirmar Cancelamento"
              )}
            </Button>

            <Button
              onClick={() => onOpenChange(false)}
              disabled={cancelling}
              variant="ghost"
              className="w-full h-[40px] rounded-xl text-[13px] text-muted-foreground hover:text-foreground"
            >
              Voltar e Manter Agendamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
