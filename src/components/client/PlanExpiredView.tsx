'use client';

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { RenovacaoSheet } from "@/components/plano/RenovacaoSheet";
import planExpiredIllustration from "@/assets/plan-expired-barber-illustration.jpg";

export interface PlanExpiredViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string;
  planPrice?: number;
  serviceName?: string;
  planDescription?: string;
  planBenefits?: string[] | any;
  planLimitAppointments?: number;
  assinaturaId?: string;
  userId?: string;
  onRenovado?: () => void;
  onChoosePlan?: () => void;
}

/**
 * Tela de renovação de plano expirado da Barbearia DUB:
 * 1. Cabeçalho com identidade visual DUB + Sair + título atual
 * 2. Ilustração centralizada de cliente preocupado por não poder cortar o cabelo
 * 3. Card principal de renovação preservado integralmente
 */
export function PlanExpiredView({
  open,
  onOpenChange,
  planName,
  planPrice,
  serviceName,
  assinaturaId,
  userId,
  onRenovado,
  onChoosePlan,
}: PlanExpiredViewProps) {
  const navigate = useNavigate();
  const [renovacaoSheetOpen, setRenovacaoSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Preço dinâmico formatado a partir dos dados reais do plano
  const preco = Number(planPrice ?? 0);
  const precoExibido = Number.isFinite(preco) && preco > 0
    ? preco.toFixed(2).replace(".", ",")
    : "0,00";

  // Nome do plano limpo para exibição dinâmica ("O seu plano [Nome] venceu.")
  const nomePlanoLimpo = (planName || "")
    .trim()
    .replace(/^meu\s+plano$/i, "")
    .replace(/^plano$/i, "")
    .replace(/^plano\s+/i, "")
    .trim();
  const statusPlanoTexto = nomePlanoLimpo
    ? `O seu plano ${nomePlanoLimpo} venceu.`
    : "O seu plano venceu.";

  // Lock de scroll ao abrir
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscroll;
    };
  }, [open]);

  const handleSair = () => {
    onOpenChange(false);
  };

  const handleRenovarMeuPlano = () => {
    if (assinaturaId) {
      setRenovacaoSheetOpen(true);
    } else {
      onOpenChange(false);
      onChoosePlan?.();
      navigate("/cliente/assinar?mode=renew");
    }
  };

  const handleEscolherOutroPlano = () => {
    onOpenChange(false);
    onChoosePlan?.();
    navigate("/cliente/assinar?mode=change");
  };

  if (!mounted) return null;

  const content = (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="plan-expired-fullscreen-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] bg-white text-neutral-900 overflow-y-auto overscroll-contain select-none"
          >
            <div className="w-full max-w-[392px] mx-auto px-4 pt-[max(env(safe-area-inset-top),0.875rem)] pb-6 flex flex-col font-sans">

              {/* ═══ 1. Cabeçalho: Título principal bem destacado + Sair alinhado ao topo ═══ */}
              <div className="flex items-start justify-between gap-2 pt-1.5 pb-0.5">
                <h1 className="text-[31px] sm:text-[33px] font-extrabold text-[#0B0B0C] tracking-[-0.032em] leading-[1.03] font-display">
                  Seu plano
                  <br />
                  chegou ao fim!
                </h1>
                <button
                  type="button"
                  onClick={handleSair}
                  className="text-[15.5px] sm:text-[16px] font-semibold text-[#18181B] hover:text-neutral-500 active:scale-95 transition-all cursor-pointer pt-1.5 pb-1 pl-2 pr-1 mr-2.5 sm:mr-3 shrink-0"
                >
                  Sair
                </button>
              </div>

              {/* ═══ 2. Ilustração ampliada e centralizada acima do card (posição preservada) ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="flex items-center justify-center my-1 pointer-events-none select-none overflow-hidden"
              >
                <img
                  src={planExpiredIllustration}
                  alt="Cliente preocupado com o vencimento do plano na barbearia"
                  className="w-[308px] sm:w-[318px] max-w-[94%] h-auto object-contain -my-2.5"
                  draggable={false}
                />
              </motion.div>

              {/* ═══ 3. Card Principal mais sóbrio e compacto, posicionado um pouco mais abaixo ═══ */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.04 }}
                className="w-[calc(100%-8px)] max-w-[332px] mx-auto bg-white rounded-[14px] border border-neutral-200/95 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] mt-5"
              >
                {/* Status sóbrio com ponto carmim informando vencimento dinâmico do plano */}
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#B91C1C] shrink-0 inline-block mt-[5px]" />
                  <span className="text-[13.5px] font-semibold text-[#B91C1C] tracking-[-0.015em] leading-[1.35]">
                    {statusPlanoTexto}
                  </span>
                </div>

                {/* Divisor horizontal 1 */}
                <div className="h-px bg-neutral-200/65 my-2.5" />

                {/* Texto explicativo mais contido e sóbrio */}
                <p className="text-[12.5px] text-[#52525B] leading-[1.46] font-normal">
                  Renove sua assinatura no <strong className="font-semibold text-[#18181B]">DUB</strong> para continuar garantindo seus cortes inclusos todo mês, com horário prioritário e a facilidade de agendar sem filas diretamente pelo app.
                </p>

                {/* Divisor horizontal 2 */}
                <div className="h-px bg-neutral-200/65 my-2.5" />

                {/* Preço dinâmico sóbrio */}
                <div className="text-[15px] font-semibold text-[#111111] tracking-[-0.02em] leading-snug mb-3.5 tabular-nums">
                  Começa com R$ {precoExibido} / mês
                </div>

                {/* Botão preto principal: exatamente no mesmo tamanho visual */}
                <button
                  type="button"
                  onClick={handleRenovarMeuPlano}
                  className="w-full h-[46px] rounded-[10px] bg-[#0D0D0D] hover:bg-neutral-900 text-white text-[14.5px] font-semibold tracking-[-0.01em] flex items-center justify-center active:scale-[0.98] transition-all cursor-pointer"
                >
                  Renovar meu plano
                </button>

                {/* Botão secundário: acessar todos os planos da barbearia para trocar */}
                <button
                  type="button"
                  onClick={handleEscolherOutroPlano}
                  className="w-full mt-2 py-1.5 text-center text-[13px] font-medium text-neutral-500 hover:text-[#111111] active:scale-[0.98] transition-colors cursor-pointer"
                >
                  Escolher outro plano
                </button>
              </motion.div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── RenovacaoSheet (quando o cliente clica para pagar) ─── */}
      {assinaturaId && (
        <RenovacaoSheet
          open={renovacaoSheetOpen}
          onOpenChange={setRenovacaoSheetOpen}
          assinaturaId={assinaturaId}
          planoNome={planName || "Plano DUB"}
          planoPreco={preco}
          servicoNome={serviceName || ""}
          userId={userId || ""}
          onRenovado={() => {
            setRenovacaoSheetOpen(false);
            onRenovado?.();
            onOpenChange(false);
          }}
        />
      )}
    </>
  );

  return createPortal(content, document.body);
}

export default PlanExpiredView;
