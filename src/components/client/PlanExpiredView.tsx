'use client';

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import renewalRefImg from "@/assets/renewal-reference.jpg";

export interface PlanExpiredViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName?: string;
  planPrice?: number;
  serviceName?: string;
  planDescription?: string;
  planBenefits?: string[] | any;
  planLimitAppointments?: number;
}

/**
 * Tela de renovação 100% idêntica em fontes, tamanhos, botões,
 * proporções e design à referência visual, com informações voltadas
 * exclusivamente ao plano de assinatura e agendamento fácil do cliente no DUB.
 */
export function PlanExpiredView({
  open,
  onOpenChange,
  planName,
  planPrice,
  serviceName,
}: PlanExpiredViewProps) {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Preço dinâmico formatado
  const preco = Number(planPrice ?? 0);
  const precoExibido = preco > 0 ? preco.toFixed(2).replace(".", ",") : "129,90";

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
    onOpenChange(false);
    navigate("/cliente/assinar?mode=renew");
  };

  const handleRenovarMaisTarde = () => {
    onOpenChange(false);
  };

  if (!mounted) return null;

  const content = (
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
          <div className="w-full max-w-[360px] mx-auto px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-8 flex flex-col">
            
            {/* ═══ Header: Mantenha seu plano ativo! + Sair ═══ */}
            <div className="flex items-center justify-between pt-1 pb-3">
              <h1 className="text-[20px] font-bold text-neutral-900 tracking-tight leading-none">
                Mantenha seu plano ativo!
              </h1>
              <button
                type="button"
                onClick={handleSair}
                className="text-[14px] font-medium text-neutral-900 hover:text-neutral-500 active:scale-95 transition-all cursor-pointer"
              >
                Sair
              </button>
            </div>

            {/* ═══ Card Principal ═══ */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.04 }}
              className="bg-white rounded-xl border border-neutral-200/90 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] mt-1"
            >
              {/* Status com ponto vermelho informando vencimento do plano */}
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0 inline-block" />
                <span className="text-[12.5px] font-semibold text-[#DC2626] tracking-tight leading-none">
                  O seu plano mensal venceu.
                </span>
              </div>

              {/* Texto explicativo baseado no plano do cliente */}
              <p className="text-[12.5px] text-neutral-700 leading-[1.55] font-normal my-2.5">
                Renove sua assinatura no DUB para continuar garantindo seus cortes inclusos todo mês, com horário prioritário e a facilidade de agendar sem filas diretamente pelo app.
              </p>

              {/* Linha divisória de 1px */}
              <div className="h-px bg-neutral-100 my-3.5" />

              {/* Preço dinâmico */}
              <div className="text-[14px] font-bold text-neutral-900 tracking-tight mb-3">
                Começa com R$ {precoExibido} / mês
              </div>

              {/* Botão preto principal: Renovar meu plano */}
              <button
                type="button"
                onClick={handleRenovarMeuPlano}
                className="w-full h-[44px] rounded-lg bg-[#18181B] hover:bg-neutral-900 text-white text-[13.5px] font-semibold flex items-center justify-center active:scale-[0.98] transition-all cursor-pointer"
              >
                Renovar meu plano
              </button>

              {/* Botão secundário: Renovar mais tarde */}
              <button
                type="button"
                onClick={handleRenovarMaisTarde}
                className="w-full mt-2 py-1 text-center text-[12px] font-medium text-neutral-500 hover:text-neutral-900 active:scale-[0.98] transition-colors cursor-pointer"
              >
                Renovar mais tarde
              </button>
            </motion.div>

            {/* ═══ Divisor com Linhas e Texto ═══ */}
            <div className="flex items-center gap-2.5 my-5 px-1">
              <div className="flex-1 h-px bg-neutral-200/80" />
              <span className="text-[11.5px] font-normal text-neutral-400 tracking-normal text-center select-none whitespace-nowrap">
                Agendamento fácil e exclusivo pelo plano
              </span>
              <div className="flex-1 h-px bg-neutral-200/80" />
            </div>

            {/* ═══ Seção: Título e Descrição ═══ */}
            <div className="text-center px-1 mb-3">
              <h2 className="text-[19px] font-bold text-neutral-900 tracking-tight leading-snug mb-1.5">
                Agende em poucos segundos
              </h2>
              <p className="text-[12px] text-neutral-500 leading-[1.5] max-w-[285px] mx-auto font-normal">
                Com o seu plano no DUB, você escolhe o melhor horário com seu barbeiro e confirma o atendimento em um toque, sem filas e com tudo incluso.
              </p>
            </div>

            {/* ═══ Imagem dos Celulares e Fundo Circular (Idêntica à Referência) ═══ */}
            <div className="w-full h-[220px] relative overflow-hidden flex items-end justify-center pointer-events-none select-none">
              <img
                src={renewalRefImg}
                alt="Agendamento pelo plano"
                className="w-[310px] h-[220px] object-cover object-bottom"
              />
            </div>

          </div>
        </motion.div>
      )}

    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

export default PlanExpiredView;
