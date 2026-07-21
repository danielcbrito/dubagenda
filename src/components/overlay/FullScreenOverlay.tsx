import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBackDismissOverlay } from "@/hooks/useBackDismissOverlay";

interface FullScreenOverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Cor de fundo (default: bg-background). */
  className?: string;
}

/**
 * Overlay de tela cheia com integração ao histórico do navegador:
 * - Renderizado via createPortal em document.body
 * - z-index 9999, fixed inset-0
 * - Swipe iOS / botão Android / seta do header → fecha SÓ o overlay
 * - Trava o scroll do body enquanto aberto
 */
export function FullScreenOverlay({
  open,
  onClose,
  title,
  children,
  className = "bg-background",
}: FullScreenOverlayProps) {
  const { dismiss } = useBackDismissOverlay(open, onClose);

  // Trava scroll do body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 flex flex-col ${className}`}
      style={{
        zIndex: 9999,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Header */}
      <div className="relative flex-shrink-0 h-12 flex items-center justify-center px-4 border-b border-border">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute left-2 p-2.5 rounded-full text-foreground active:scale-90 transition-transform"
          style={{ touchAction: "manipulation" }}
        >
          <X className="w-5 h-5" />
        </button>
        {title && (
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        )}
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>,
    document.body
  );
}
