'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  QrCode,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { type DividaItem } from '@/hooks/useDividas';

interface DebtPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divida: DividaItem | null;
  onPaymentSuccess?: () => void;
}

export function DebtPaymentModal({
  open,
  onOpenChange,
  divida,
  onPaymentSuccess,
}: DebtPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pixData, setPixData] = useState<{
    br_code?: string;
    qr_code_image?: string;
    expires_at?: string;
  } | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(3600);

  // Formatar data do cancelamento
  const formattedDate = useMemo(() => {
    if (!divida) return '';
    const rawDate = divida.agendamento_data || divida.criado_em;
    if (!rawDate) return '';
    try {
      // Se for apenas YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [y, m, d] = rawDate.split('-');
        return `${d}/${m}/${y}`;
      }
      const d = new Date(rawDate);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return rawDate;
    }
  }, [divida]);

  const valorFormatado = useMemo(() => {
    if (!divida) return 'R$ 0,00';
    return Number(divida.valor_total || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }, [divida]);

  // Se a dívida já possuía PIX gerado anteriormente, pré-carrega
  useEffect(() => {
    if (divida?.pix_qr_code) {
      setPixData({
        br_code: divida.pix_qr_code,
      });
    } else {
      setPixData(null);
    }
    setIsPaid(false);
  }, [divida]);

  // Função para chamar o gateway Woovi e gerar QR Code com split
  const handleGeneratePix = async () => {
    if (!divida) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('cancellation-debt', {
        body: {
          action: 'create',
          dividaId: divida.id,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Falha ao gerar cobrança PIX');
      }

      if (data?.paid) {
        setIsPaid(true);
        toast.success('Pendência quitada com sucesso!');
        setTimeout(() => {
          onPaymentSuccess?.();
          onOpenChange(false);
        }, 1500);
        return;
      }

      setPixData({
        br_code: data.br_code,
        qr_code_image: data.qr_code_image,
        expires_at: data.expires_at,
      });
      toast.success('Código PIX gerado com sucesso!');
    } catch (err: any) {
      console.error('[DebtPaymentModal] Erro ao gerar PIX:', err);
      toast.error(err?.message || 'Não foi possível gerar o código PIX. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Copiar código PIX
  const handleCopyPix = useCallback(() => {
    const code = pixData?.br_code || divida?.pix_qr_code;
    if (!code) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setCopied(true);
    toast.success('Código Pix Copia e Cola copiado!');
    setTimeout(() => setCopied(false), 3000);
  }, [pixData, divida]);

  // Polling e Realtime para confirmação instantânea do pagamento
  useEffect(() => {
    if (!open || !divida || isPaid) return;

    let disposed = false;

    // 1. Polling a cada 5 segundos na Edge Function
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke('cancellation-debt', {
          body: { action: 'status', dividaId: divida.id },
        });

        if (!disposed && data?.paid) {
          setIsPaid(true);
          toast.success('Pagamento confirmado! Você já pode agendar novamente.');
          window.dispatchEvent(new Event('cancellation-debt-changed'));
          setTimeout(() => {
            onPaymentSuccess?.();
            onOpenChange(false);
          }, 1800);
        }
      } catch (pollErr) {
        // silencioso
      }
    }, 5000);

    // 2. Realtime na tabela dividas
    const channel = supabase
      .channel(`modal-divida-${divida.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dividas',
          filter: `id=eq.${divida.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated && updated.status === 'pago') {
            setIsPaid(true);
            toast.success('Pagamento confirmado! Você já pode agendar novamente.');
            window.dispatchEvent(new Event('cancellation-debt-changed'));
            setTimeout(() => {
              onPaymentSuccess?.();
              onOpenChange(false);
            }, 1800);
          }
        }
      )
      .subscribe();

    return () => {
      disposed = true;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [open, divida, isPaid, onPaymentSuccess, onOpenChange]);

  if (!divida) return null;

  const currentPixCode = pixData?.br_code || divida.pix_qr_code;
  const currentQrImage = pixData?.qr_code_image;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] w-[calc(100vw-2rem)] rounded-3xl border border-border/60 bg-background/95 backdrop-blur-xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.18)] text-center overflow-hidden [&>button]:top-4 [&>button]:right-4">
        <AnimatePresence mode="wait">
          {/* TELA DE SUCESSO: PAGAMENTO CONFIRMADO */}
          {isPaid ? (
            <motion.div
              key="paid-success"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="py-6 flex flex-col items-center justify-center space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-foreground">
                Pagamento confirmado!
              </h3>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Sua taxa foi quitada com sucesso. Você já está liberado para realizar novos agendamentos!
              </p>
            </motion.div>
          ) : currentPixCode ? (
            /* TELA DO QR CODE PIX GERADO */
            <motion.div
              key="pix-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4 pt-1"
            >
              <div className="flex flex-col items-center text-center space-y-1">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
                  <QrCode className="w-6 h-6 stroke-[2]" />
                </div>
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  Pagar taxa via PIX
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Escaneie o QR Code ou copie a chave Pix para regularizar sua conta.
                </DialogDescription>
              </div>

              {/* Valor em destaque */}
              <div className="py-2.5 px-4 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Valor da taxa (20%):</span>
                <span className="text-base font-bold text-foreground tabular-nums">
                  {valorFormatado}
                </span>
              </div>

              {/* Imagem do QR Code se disponível */}
              {currentQrImage && (
                <div className="flex justify-center p-3 bg-white rounded-2xl border border-border/60 shadow-sm mx-auto w-fit">
                  <img
                    src={currentQrImage}
                    alt="QR Code PIX"
                    className="w-44 h-44 object-contain"
                  />
                </div>
              )}

              {/* Campo de Código Copia e Cola */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                  <span>Pix Copia e Cola</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={currentPixCode}
                    className="w-full h-10 px-3 pr-10 text-xs font-mono rounded-xl bg-muted/50 border border-border/60 text-foreground truncate focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="absolute right-1.5 top-1.5 h-7 w-7 rounded-lg bg-foreground text-background flex items-center justify-center hover:bg-foreground/90 transition-all active:scale-95"
                    title="Copiar código"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Status com animação de pulso */}
              <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Aguardando pagamento... A liberação é imediata.</span>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  onClick={handleCopyPix}
                  className="w-full h-11 rounded-xl text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      Código copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar código PIX
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                >
                  Pagar depois
                </Button>
              </div>
            </motion.div>
          ) : (
            /* TELA PRINCIPAL: AVISO CLARO DA DÍVIDA COM BOTÃO "PAGAR AGORA" */
            <motion.div
              key="debt-notice"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4 pt-1"
            >
              {/* Ícone de alerta em destaque */}
              <div className="w-13 h-13 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-sm">
                <AlertTriangle className="w-7 h-7 stroke-[2]" />
              </div>

              <DialogHeader className="px-0 pb-1 text-center space-y-2">
                <DialogTitle className="text-center text-lg font-bold tracking-tight text-foreground">
                  Pendência financeira
                </DialogTitle>

                {/* TEXTO EXATO DA REGRA DE NEGÓCIO:
                    “Você tem uma pendência de R$X,XX referente ao cancelamento do dia [data]. Pague para continuar agendando.” */}
                <div className="rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 p-4 text-center">
                  <p className="text-[13.5px] text-foreground/90 leading-relaxed font-medium">
                    Você tem uma pendência de{' '}
                    <strong className="text-amber-700 dark:text-amber-400 font-bold tabular-nums">
                      {valorFormatado}
                    </strong>{' '}
                    referente ao cancelamento do dia{' '}
                    <strong className="text-foreground font-semibold">{formattedDate}</strong>.
                  </p>
                  <p className="text-[12.5px] text-muted-foreground mt-1.5">
                    Pague para continuar agendando.
                  </p>
                </div>
              </DialogHeader>

              {/* Informações detalhadas do split */}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between items-center">
                  <span>Profissional:</span>
                  <span className="font-semibold text-foreground">{divida.barbeiro_nome || 'Barbeiro'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Divisão da taxa (50/50):</span>
                  <span className="text-[11px] font-medium text-foreground/80">
                    50% Barbeiro • 50% Plataforma
                  </span>
                </div>
              </div>

              {/* BOTÃO "PAGAR AGORA" */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={handleGeneratePix}
                  disabled={loading}
                  className="w-full h-11 text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 rounded-xl shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      Gerando PIX com split...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      Pagar agora
                      <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="w-full h-9 text-xs text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Fechar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default DebtPaymentModal;
