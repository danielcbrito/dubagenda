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
}

export function PaymentOption({ 
  value, 
  selected, 
  onSelect, 
  title, 
  description, 
  highlight = false,
  icon
}: PaymentOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl p-4 transition-all duration-200 border",
        highlight && "bg-gold/5 border-gold/30",
        !highlight && selected && "bg-primary/10 border-primary/50",
        !highlight && !selected && "bg-card border-border hover:bg-secondary"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {icon && (
            <div className="flex-shrink-0 mt-0.5">{icon}</div>
          )}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        </div>

        <div className={cn(
          "flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center mt-0.5",
          selected 
            ? highlight 
              ? "bg-gold border-gold"
              : "bg-primary border-primary"
            : "border-muted-foreground/30"
        )}>
          {selected && (
            <div className="w-1.5 h-1.5 bg-primary-foreground rounded-full" />
          )}
        </div>
      </div>
    </button>
  );
}
