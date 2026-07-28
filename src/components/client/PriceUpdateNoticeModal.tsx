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
          transition={{ duration: 0.22 }}
          className="fixed inset-0 flex items-center justify-center px-5"
          style={{
            zIndex: 9998,
            background: "hsl(var(--foreground) / 0.28)",
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
          }}
          onClick={details ? undefined : close}
        >
          {!details ? (
            /* ---------- Card compacto ---------- */
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[340px] rounded-[26px] border border-border/70 bg-card px-7 pt-9 pb-7 text-center"
              style={{ boxShadow: "0 30px 70px -24px hsl(var(--foreground) / 0.4)" }}
            >
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="absolute top-3 right-3 p-2 rounded-full text-muted-foreground/70 active:scale-90 transition-transform"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={2.2} />
              </button>

              <AlertTriangle
                className="w-9 h-9 mx-auto mb-5"
                strokeWidth={1.6}
                style={{ color: "hsl(38 96% 48%)" }}
              />

              <p className="text-[9.5px] font-semibold text-muted-foreground/55 uppercase tracking-[0.24em] mb-2.5">
                {notice.eyebrow}
              </p>
              <h2 className="text-[19px] font-semibold text-foreground font-display tracking-tight mb-3">
                {notice.title}
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-7">
                {notice.summary}
              </p>

              <button
                type="button"
                onClick={() => setDetails(true)}
                className="w-full h-12 rounded-2xl bg-foreground text-background text-[14px] font-semibold flex items-center justify-center gap-1 active:scale-[0.97] transition-transform"
              >
                Saiba mais sobre as mudanças
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            /* ---------- Tela cheia de detalhes ---------- */
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-0 bg-background flex flex-col"
            >
              <div className="flex-shrink-0 flex items-center h-14 px-2 pt-[env(safe-area-inset-top)]">
                <button
                  type="button"
                  onClick={() => setDetails(false)}
                  aria-label="Voltar"
                  className="p-2.5 rounded-full text-foreground active:scale-90 transition-transform"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="mx-auto text-[9.5px] font-semibold text-muted-foreground/55 uppercase tracking-[0.24em]">
                  {notice.eyebrow}
                </span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar"
                  className="p-2.5 rounded-full text-muted-foreground active:scale-90 transition-transform"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                <AlertTriangle
                  className="w-8 h-8 mb-5"
                  strokeWidth={1.6}
                  style={{ color: "hsl(38 96% 48%)" }}
                />
                <h1 className="text-[22px] font-semibold text-foreground font-display tracking-tight leading-tight mb-2">
                  {notice.detailsTitle}
                </h1>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-8">
                  {notice.summary}
                </p>

                <div className="space-y-6">
                  {notice.topics.map((item, i) => (
                    <motion.div
                      key={item.t}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.05 }}
                      className="border-t border-border pt-4"
                    >
                      <p className="text-[14px] font-semibold text-foreground leading-snug mb-1">
                        {item.t}
                      </p>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        {item.d}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <p className="text-[12.5px] text-muted-foreground leading-relaxed border-t border-border pt-6 mt-8">
                  {notice.footer}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
