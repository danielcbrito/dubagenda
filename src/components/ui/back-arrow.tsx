import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackArrowProps {
  className?: string;
  size?: number;
}

/** Seta em V (chevron) — padrão clean do design system. Substitui setas curvadas em botões de voltar. */
export function BackArrow({ className, size = 32 }: BackArrowProps) {
  return (
    <ChevronLeft
      size={size}
      strokeWidth={2.5}
      className={cn("shrink-0", className)}
    />
  );
}
