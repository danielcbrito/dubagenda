import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackArrowProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
  onClick?: () => void;
}

/** Seta em V (chevron) — padrão clean do design system. Substitui setas curvadas em botões de voltar. */
export function BackArrow({ className, size = 32, strokeWidth = 2.5, onClick }: BackArrowProps) {
  return (
    <ChevronLeft
      size={size}
      strokeWidth={strokeWidth}
      onClick={onClick}
      className={cn("shrink-0", className)}
    />
  );
}
