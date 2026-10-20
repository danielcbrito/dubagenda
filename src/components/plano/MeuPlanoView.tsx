import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { BottomNavigation } from "@/components/BottomNavigation";
import { RenovacaoSheet } from "@/components/plano/RenovacaoSheet";

export interface MeuPlanoSub {
  id: string;
  status: string;
  next_billing_date: string | null;
  ciclo_fim: string | null;
  usos_ciclo_atual: number | null;
  user_id: string;
  plano: {
    nome: string;
    preco_mensal: number;
    limite_agendamentos_mes: number | null;
    servico: { nome: string } | null;
  } | null;
}

interface MeuPlanoViewProps {
  sub: MeuPlanoSub;
  onRenovado: () => void;
  onVerPlanos: () => void;
}

/** Tela do plano do assinante: situação atual + renovação em destaque */
export function MeuPlanoView({ sub, onRenovado, onVerPlanos }: MeuPlanoViewProps) {
  const [open, setOpen] = useState(false);

  const fim = sub.ciclo_fim || sub.next_billing_date;
  const fimDate = fim ? new Date(`${fim}T23:59:59`) : null;
  const vencido = !fimDate || fimDate < new Date() || sub.status !== "active";
  const limite = sub.plano?.limite_agendamentos_mes ?? 0;
  const usados = Math.min(sub.usos_ciclo_atual ?? 0, limite || Infinity);
  const restantes = Math.max(limite - usados, 0);
  const preco = Number(sub.plano?.preco_mensal ?? 0);

  return (
    <div
      className="fixed inset-0 flex flex-col bg-background"
      style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <h1 className="text-lg font-bold text-foreground">Meu Plano</h1>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-24">
        <div className="max-w-md mx-auto pt-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-5 shadow-[0_2px_8px_hsl(var(--foreground)/0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Seu plano
                </p>
                <p className="text-xl font-bold text-foreground mt-1">{sub.plano?.nome}</p>
                {sub.plano?.servico?.nome && (
                  <p className="text-sm text-muted-foreground mt-0.5">{sub.plano.servico.nome}</p>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0",
                  vencido ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                )}
              >
                {vencido ? "Vencido" : "Ativo"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Cortes restantes
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground mt-1">
                  {vencido ? 0 : restantes}
                  <span className="text-sm font-medium text-muted-foreground">/{limite}</span>
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {vencido ? "Venceu em" : "Renova em"}
                </p>
                <p className="text-base font-bold text-foreground mt-2">
                  {fimDate ? format(fimDate, "dd 'de' MMM", { locale: ptBR }) : "—"}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="space-y-3">
            <button
              onClick={() => navigate("/cliente/assinar?mode=renew")}
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground text-base font-bold active:scale-[0.98] transition-transform"
            >
              Renovar plano · R$ {preco.toFixed(2).replace(".", ",")}
            </button>
            <p className="text-xs text-center text-muted-foreground">
              {vencido
                ? "Renove para voltar a agendar pelo plano."
                : "Você pode renovar antes do vencimento se precisar."}
            </p>
            <button
              onClick={onVerPlanos}
              className="w-full h-11 rounded-xl border border-border text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
            >
              Ver outros planos
            </button>
          </div>
        </div>
      </div>

      <RenovacaoSheet
        open={open}
        onOpenChange={setOpen}
        assinaturaId={sub.id}
        planoNome={sub.plano?.nome || "Plano"}
        planoPreco={preco}
        servicoNome={sub.plano?.servico?.nome || ""}
        userId={sub.user_id}
        onRenovado={onRenovado}
      />

      <BottomNavigation />
    </div>
  );
}
