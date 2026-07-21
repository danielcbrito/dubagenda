import { useState } from "react";
import { FullScreenOverlay } from "./FullScreenOverlay";
import { Loader2 } from "lucide-react";

interface CancelAppointmentOverlayProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void> | void;
}

/**
 * Exemplo real de uso do padrão FullScreenOverlay:
 * tela de cancelamento de agendamento.
 *
 * Comportamento:
 * - Swipe iOS / botão físico Android / X no header → todos fecham SÓ este overlay
 * - Sem afetar a tela de baixo (ex.: detalhes do agendamento)
 */
export function CancelAppointmentOverlay({
  open,
  onClose,
  onConfirm,
}: CancelAppointmentOverlayProps) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm(motivo.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <FullScreenOverlay open={open} onClose={onClose} title="Cancelar agendamento">
      <div className="px-6 py-6 max-w-md mx-auto flex flex-col gap-5">
        <div>
          <h3 className="text-[20px] font-semibold text-foreground leading-tight">
            Tem certeza que deseja cancelar?
          </h3>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Você pode reagendar a qualquer momento. Se houver crédito, ele volta
            para sua carteira automaticamente.
          </p>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
            Motivo (opcional)
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Conte para o barbeiro o que aconteceu"
            rows={4}
            className="w-full rounded-xl bg-muted/40 border border-border px-4 py-3 outline-none focus:border-foreground/40 resize-none"
            style={{ fontSize: 16 }}
          />
        </div>

        <div className="mt-auto flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="w-full min-h-[48px] rounded-xl bg-destructive text-destructive-foreground font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
            style={{ touchAction: "manipulation" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar cancelamento"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[48px] rounded-xl font-medium text-[14px] text-muted-foreground active:scale-[0.98] transition-transform"
            style={{ touchAction: "manipulation" }}
          >
            Manter agendamento
          </button>
        </div>
      </div>
    </FullScreenOverlay>
  );
}
