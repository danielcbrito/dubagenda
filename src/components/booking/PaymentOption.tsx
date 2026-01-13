import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentOptionProps {
  value: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  highlight?: boolean;
}

export function PaymentOption({ 
  value, 
  selected, 
  onSelect, 
  title, 
  description, 
  highlight = false 
}: PaymentOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-2xl p-5 transition-all duration-200 border",
        highlight && "bg-gradient-to-br from-orange-500/5 to-yellow-500/5 border-orange-500/30",
        !highlight && selected && "bg-primary/5 border-primary/50 shadow-lg shadow-primary/10",
        !highlight && !selected && "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-zinc-400">
            {description}
          </p>
        </div>

        <div className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center mt-0.5",
          selected 
            ? highlight 
              ? "bg-gradient-to-br from-orange-500 to-yellow-500 border-orange-500"
              : "bg-primary border-primary"
            : "border-white/20"
        )}>
          {selected && (
            <div className="w-2 h-2 bg-white rounded-full" />
          )}
        </div>
      </div>
    </button>
  );
}
