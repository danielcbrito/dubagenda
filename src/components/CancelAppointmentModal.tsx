'use client';

import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarX2, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCancelAppointment } from "@/hooks/useClientMutations";
import { supabase } from "@/integrations/supabase/client";

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

// Cache em memória para eliminar latência em reaberturas e evitar loading repetido
const quoteCache = new Map<string, QuoteState>();

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

  const isPaidWithCredit =
    paymentMethod === 'credit' ||
    paymentMethod === 'wallet' ||
    observacoes?.toLowerCase().includes('crédito do app') ||
    observacoes?.toLowerCase().includes('credito do app');

  const isPrepaid = isPaid || isPaidWithCredit || paymentMethod === 'pix' || paymentMethod === 'card' || paymentMethod === 'credit_card';

  // 1. Cálculo instantâneo no cliente (Zero Latency):
  // Se faltam mais de 2 horas para o horário agendado, pela regra do sistema o cancelamento é 100% gratuito.
  const optimisticInitialQuote = useMemo<QuoteState | null>(() => {
    if (quoteCache.has(appointmentId)) {
      return quoteCache.get(appointmentId)!;
    }
    if (appointmentMeta?.data && appointmentMeta?.hora) {
      try {
        const aptTime = new Date(`${appointmentMeta.data}T${appointmentMeta.hora}`).getTime();
        if (!isNaN(aptTime)) {
          const hoursLeft = (aptTime - Date.now()) / 3600000;
          if (hoursLeft >= 2) {
            return {
              id: appointmentId,
              fee: 0,
              isFree: true,
              horasRestantes: Math.round(hoursLeft * 10) / 10,
              originalPrice: amount,
              isPrepaid,
              valorPago: amount,
              refundAmount: isPrepaid ? amount : 0,
              vaiDescontarReembolso: false,
              vaiGerarDivida: false,
              error: false,
            };
          }
        }
      } catch {
        // Fallback para background fetch
      }
    }
    return null;
  }, [appointmentId, appointmentMeta?.data, appointmentMeta?.hora, amount, isPrepaid]);

  const [quote, setQuote] = useState<QuoteState | null>(optimisticInitialQuote);

  useEffect(() => {
    if (!open) return;
    let disposed = false;

    // Se já temos quote no cache ou calculado optimistamente para >2h, usa imediatamente sem loading
    if (optimisticInitialQuote && optimisticInitialQuote.id === appointmentId) {
      setQuote(optimisticInitialQuote);
    }

    async function loadQuote() {
      try {
        let quoteData: any = null;

        // 1. Tenta consulta pela Edge Function
        const { data: edgeData, error: edgeError } = await supabase.functions
          .invoke('cancellation-debt', { body: { action: 'quote', appointmentId } });

        if (!edgeError && edgeData && !edgeData.error) {
          quoteData = edgeData;
        } else {
          // 2. Fallback direto via RPC Postgres (resiliência total)
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('quote_client_cancellation', { p_appointment: appointmentId, p_user: userId });

          if (!rpcError && rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData) && !rpcData.error) {
            quoteData = rpcData;
          }
        }

        if (disposed) return;

        if (quoteData) {
          const fee = Number(quoteData.valor_taxa) || 0;
          const isFree = fee === 0 || Boolean(quoteData.is_free);
          const valorPago = Number(quoteData.valor_pago ?? amount) || 0;
          const estimatedRefund = Number(quoteData.valor_reembolso_estimado ?? Math.max(0, valorPago - fee));

          const resolvedQuote: QuoteState = {
            id: appointmentId,
            fee,
            isFree,
            horasRestantes: quoteData.horas_restantes,
            originalPrice: Number(quoteData.valor_servico_original) || amount,
            isPrepaid: Boolean(quoteData.is_prepaid ?? isPrepaid),
            valorPago,
            refundAmount: estimatedRefund,
            vaiDescontarReembolso: Boolean(quoteData.vai_descontar_reembolso ?? (isPrepaid && fee > 0 && valorPago >= fee)),
            vaiGerarDivida: Boolean(quoteData.vai_gerar_divida ?? (!isPrepaid && fee > 0)),
            error: false,
          };

          quoteCache.set(appointmentId, resolvedQuote);
          setQuote(resolvedQuote);
          return;
        }

        // Fallback seguro caso não consiga consultar taxa
        const fallbackQuote: QuoteState = {
          id: appointmentId,
          fee: 0,
          isFree: true,
          originalPrice: amount,
          isPrepaid,
          valorPago: amount,
          refundAmount: isPrepaid ? amount : 0,
          vaiDescontarReembolso: false,
          vaiGerarDivida: false,
          error: false,
        };
        setQuote(fallbackQuote);
      } catch {
        if (!disposed) {
          const fallbackQuote: QuoteState = {
            id: appointmentId,
            fee: 0,
            isFree: true,
            originalPrice: amount,
            isPrepaid,
            valorPago: amount,
            refundAmount: isPrepaid ? amount : 0,
            vaiDescontarReembolso: false,
            vaiGerarDivida: false,
            error: false,
          };
          setQuote(fallbackQuote);
        }
      }
    }

    void loadQuote();

    return () => {
      disposed = true;
    };
  }, [open, appointmentId, amount, isPrepaid, userId, optimisticInitialQuote]);

  const quoteReady = quote?.id === appointmentId;

  const handleCancelDefinitely = () => {
    cancelAppointment({
      appointmentId,
      appointmentMeta: appointmentMeta || { preco: amount },
      onSuccess: () => {
        quoteCache.delete(appointmentId);
        onSuccess();
        onOpenChange(false);
      },
    });
  };

  const hasFee = Boolean(quoteReady && quote && !quote.isFree && quote.fee > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px] w-[calc(100vw-2rem)] rounded-3xl border border-border/60 bg-background/95 backdrop-blur-xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.14)] overflow-hidden [&>button]:top-4 [&>button]:right-4">
        {/* Cabeçalho Resumido */}
        <div className="flex flex-col items-center text-center space-y-1 pt-1 pb-1">
          <div className="w-10 h-10 rounded-2xl bg-destructive/[0.08] text-destructive flex items-center justify-center mb-1 transition-transform">
            <CalendarX2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <DialogTitle className="text-[17px] font-bold text-foreground tracking-tight">
            Cancelar agendamento
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-muted-foreground leading-snug">
            {appointmentMeta?.servico ? (
              <span className="font-medium text-foreground/80">
                {appointmentMeta.servico}
                {appointmentMeta.hora ? ` • ${appointmentMeta.hora.slice(0, 5)}` : ''}
              </span>
            ) : (
              'Confirme o cancelamento do seu horário'
            )}
          </DialogDescription>
        </div>

        {/* Card Resumido de Condição */}
        <div className="py-2">
          <AnimatePresence mode="wait">
            {!quoteReady ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-border/50 bg-muted/40 p-3.5 flex items-center justify-center gap-2.5 text-xs text-muted-foreground"
              >
                <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                <span>Verificando política...</span>
              </motion.div>
            ) : hasFee && quote ? (
              <motion.div
                key="fee"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-[12.5px] font-semibold">Menos de 2h</span>
                  </div>
                  <span className="text-[13px] font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                    Taxa: {brl(quote.fee)}
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                  {quote.isPrepaid && quote.valorPago > 0 ? (
                    <>
                      Descontada do Pix. Reembolso líquido:{' '}
                      <strong className="text-foreground font-semibold">{brl(quote.refundAmount)}</strong> na carteira.
                    </>
                  ) : (
                    <>Taxa pendente somada no seu próximo agendamento.</>
                  )}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="free"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Cancelamento sem taxa
                  </p>
                  <p className="text-[11.5px] text-muted-foreground leading-snug mt-0.5">
                    {quote?.isPrepaid && (quote.valorPago ?? 0) > 0
                      ? `Reembolso de ${brl(quote.valorPago)} na sua carteira.`
                      : 'Nenhum valor será cobrado.'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Botões de Ação Compactos */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleCancelDefinitely}
            disabled={cancelling}
            className="w-full h-11 rounded-xl text-[13.5px] font-semibold tracking-tight bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 shadow-sm transition-all active:scale-[0.98]"
          >
            {cancelling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelando...
              </>
            ) : (
              "Confirmar cancelamento"
            )}
          </Button>

          <Button
            onClick={() => onOpenChange(false)}
            disabled={cancelling}
            variant="ghost"
            className="w-full h-9 rounded-xl text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all active:scale-[0.98]"
          >
            Voltar e manter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CancelAppointmentModal;
