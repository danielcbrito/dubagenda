import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, ChevronRight, ArrowLeft } from "lucide-react";

/** ID da Barbearia DUB (matriz). */
const TENANT_DUB = "73d61f2f-b369-41f3-8915-8e6de52d6378";

interface NoticeTopic {
  t: string;
  d: string;
}

interface TenantNotice {
  /** Identificador do aviso — mudar para reexibir uma nova versão. */
  id: string;
  eyebrow: string;
  title: string;
  summary: React.ReactNode;
  detailsTitle: string;
  topics: NoticeTopic[];
  footer: string;
}

/**
 * Avisos por barbearia. Cada tenant só vê o próprio comunicado.
 * (Futuramente estes dados virão da configuração do painel do barbeiro.)
 */
const NOTICES_BY_TENANT: Record<string, TenantNotice> = {
  [TENANT_DUB]: {
    id: "dub-reajuste-2026-08",
    eyebrow: "Comunicado",
    title: "Reajuste de valores",
    summary: (
      <>
        A partir do dia{" "}
        <span className="font-semibold text-foreground">20 de agosto</span>, alguns
        serviços da Barbearia DUB terão seus valores reajustados.
      </>
    ),
    detailsTitle: "O que muda a partir de 20 de agosto",
    topics: [
      {
        t: "Novos valores em alguns serviços",
        d: "Apenas parte do cardápio será reajustada. Os valores atualizados aparecem automaticamente no app na hora do agendamento.",
      },
      {
        t: "Agendamentos já confirmados",
        d: "Horários agendados e pagos antes do dia 20 de agosto mantêm o valor original.",
      },
      {
        t: "Planos e benefícios",
        d: "Assinaturas ativas, créditos de indicação e cortes do programa de fidelidade continuam válidos normalmente.",
      },
      {
        t: "Por que o reajuste",
        d: "Atualização de custos e investimento contínuo em estrutura, produtos e qualidade do atendimento.",
      },
    ],
    footer:
      "Obrigado pela confiança e por fazer parte da nossa caminhada. Seguimos comprometidos em entregar o melhor para você.",
  },
};

interface PriceUpdateNoticeModalProps {
  /** Barbearia preferida do cliente. O aviso só aparece se houver comunicado para ela. */
  tenantId?: string | null;
}

/**
 * Aviso estratégico exibido ao entrar no app (uma vez por sessão),
 * restrito aos clientes da barbearia que publicou o comunicado.
 */
export function PriceUpdateNoticeModal({ tenantId }: PriceUpdateNoticeModalProps) {
  const notice = tenantId ? NOTICES_BY_TENANT[tenantId] : undefined;
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    if (!notice) return;
    if (sessionStorage.getItem(`dub:aviso:${notice.id}`)) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!notice) return null;

  const close = () => {
    sessionStorage.setItem(`dub:aviso:${notice.id}`, "1");
    setOpen(false);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="price-notice"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 flex items-center justify-center px-5"
          style={{ zIndex: 9998, background: "hsl(var(--foreground) / 0.45)" }}
          onClick={close}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-2xl border border-border bg-card overflow-hidden"
            style={{ boxShadow: "0 24px 60px -20px hsl(var(--foreground) / 0.35)" }}
          >
            {/* Header */}
            <div className="relative flex items-center justify-center h-12 border-b border-border">
              {details ? (
                <button
                  type="button"
                  onClick={() => setDetails(false)}
                  aria-label="Voltar"
                  className="absolute left-2 p-2.5 rounded-full text-foreground active:scale-90 transition-transform"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : null}
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.18em]">
                {notice.eyebrow}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="absolute right-2 p-2.5 rounded-full text-muted-foreground active:scale-90 transition-transform"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!details ? (
              <div className="px-6 pt-6 pb-5 flex flex-col items-center text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border"
                  style={{
                    background: "hsl(42 100% 50% / 0.12)",
                    borderColor: "hsl(42 100% 50% / 0.35)",
                  }}
                >
                  <AlertTriangle
                    className="w-7 h-7"
                    strokeWidth={2.2}
                    style={{ color: "hsl(38 96% 45%)" }}
                  />
                </div>

                <h2 className="text-[17px] font-semibold text-foreground font-display tracking-tight mb-2">
                  {notice.title}
                </h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-6">
                  {notice.summary}
                </p>

                <button
                  type="button"
                  onClick={() => setDetails(true)}
                  className="w-full h-11 rounded-xl bg-foreground text-background text-[14px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
                >
                  Saiba mais sobre as mudanças
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="w-full h-10 mt-2 rounded-xl text-[13px] font-medium text-muted-foreground active:scale-[0.97] transition-transform"
                >
                  Entendi
                </button>
              </div>
            ) : (
              <div className="px-6 pt-5 pb-5">
                <h2 className="text-[15px] font-semibold text-foreground font-display tracking-tight mb-4">
                  {notice.detailsTitle}
                </h2>

                <div className="space-y-3.5 mb-6">
                  {notice.topics.map((item) => (
                    <div key={item.t} className="flex gap-3">
                      <div className="w-1 rounded-full bg-primary/40 flex-shrink-0 mt-1 mb-1" />
                      <div>
                        <p className="text-[13px] font-semibold text-foreground leading-snug">
                          {item.t}
                        </p>
                        <p className="text-[12px] text-muted-foreground leading-relaxed mt-0.5">
                          {item.d}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[12px] text-muted-foreground leading-relaxed border-t border-border pt-4 mb-5">
                  {notice.footer}
                </p>

                <button
                  type="button"
                  onClick={close}
                  className="w-full h-11 rounded-xl bg-foreground text-background text-[14px] font-semibold active:scale-[0.97] transition-transform"
                >
                  Entendi
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
