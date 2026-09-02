import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlimPillButtonProps {
  label: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Slim pill CTA button — 44px tall, full-radius, dark opaque,
 * with ripple micro-interaction and hover elevation.
 */
export function SlimPillButton({
  label,
  onClick,
  isLoading = false,
  disabled = false,
  className,
  ariaLabel,
}: SlimPillButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;

      // Create ripple
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 500);

      onClick();
    },
    [onClick, disabled, isLoading]
  );

  return (
    <motion.button
      ref={btnRef}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel || label}
      aria-busy={isLoading}
      whileHover={{ y: -2 }}
      whileTap={{ y: 1, scale: 0.997 }}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden",
        "h-[44px] w-full max-w-[360px] rounded-[28px]",
        "font-semibold text-[16px] tracking-[0.2px]",
        "border-none cursor-pointer",
        "transition-shadow duration-160",
        "focus-visible:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
        className
      )}
      style={{
        background: "hsl(0 0% 6%)",
        color: "hsl(0 0% 100%)",
        boxShadow: "0 8px 20px rgba(8,8,8,0.22)",
        WebkitTapHighlightColor: "transparent",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      {/* Ripple effects */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: r.x - 80,
            top: r.y - 80,
            width: 160,
            height: 160,
            background: "rgba(255,255,255,0.14)",
            animation: "rippleAnim 480ms cubic-bezier(.22,.9,.22,1) forwards",
          }}
        />
      ))}

      {/* Content */}
      <span className="relative z-10 inline-flex items-center gap-2">
        {isLoading ? (
          <Loader2 className="w-[18px] h-[18px] animate-spin" style={{ color: "hsl(0 0% 100%)" }} />
        ) : (
          <span>{label}</span>
        )}
      </span>
    </motion.button>
  );
}
