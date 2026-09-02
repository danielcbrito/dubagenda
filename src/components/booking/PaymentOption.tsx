import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PaymentOptionProps {
  value: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  highlight?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  disabledLabel?: string;
}

export function PaymentOption({ 
  value, 
  selected, 
  onSelect, 
  title, 
  description, 
  highlight = false,
  icon,
  disabled = false,
  disabledLabel = "Em breve"
}: PaymentOptionProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        "w-full text-left rounded-lg p-3 transition-all duration-200 border relative",
        disabled && "opacity-50 cursor-not-allowed bg-muted border-border",
        !disabled && highlight && "bg-gold/5 border-gold/30",
        !disabled && !highlight && selected && "bg-primary/10 border-primary/50",
        !disabled && !highlight && !selected && "bg-card border-border hover:bg-secondary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1">
          {icon && (
            <div className={cn("flex-shrink-0 mt-0.5", disabled && "grayscale")}>{icon}</div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-semibold mb-0.5", disabled ? "text-muted-foreground" : "text-foreground")}>
                {title}
              </h3>
              {disabled && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full">
                  {disabledLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className={cn(
          "flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center mt-0.5",
          disabled
            ? "border-muted-foreground/20"
            : selected 
              ? highlight 
                ? "bg-gold border-gold"
                : "bg-primary border-primary"
              : "border-muted-foreground/30"
        )}>
          {selected && !disabled && (
            <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
          )}
        </div>
      </div>
    </button>
  );
}
