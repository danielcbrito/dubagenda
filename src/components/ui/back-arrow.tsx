import { cn } from "@/lib/utils";

interface BackArrowProps {
  className?: string;
  size?: number;
}

/** Seta curvada premium — padrão do design system. Substitui ArrowLeft/ChevronLeft em botões de voltar. */
export function BackArrow({ className, size = 22 }: BackArrowProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a4 4 0 0 1 4 4v1" />
    </svg>
  );
}
