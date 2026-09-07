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
        "w-full text-left rounded-2xl p-3.5 transition-all duration-200 relative border",
        disabled && "opacity-50 cursor-not-allowed bg-neutral-50 border-neutral-100",
        !disabled && selected && "bg-neutral-50/80 border-neutral-200/70 shadow-xs",
        !disabled && !selected && "bg-transparent border-transparent hover:bg-neutral-50/60"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {icon && (
            <div className={cn("flex-shrink-0 w-8 h-8 flex items-center justify-center", disabled && "grayscale")}>
              {icon}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className={cn("text-[14px] font-medium tracking-tight", disabled ? "text-neutral-400" : "text-[#18181B]")}>
                {title}
              </h3>
              {disabled && (
                <span className="text-[10px] font-medium uppercase tracking-wider bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded-full">
                  {disabledLabel}
                </span>
              )}
            </div>
            {description && (
              <p className="text-[12px] text-neutral-400 mt-0.5 font-normal">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className={cn(
          "flex-shrink-0 w-[22px] h-[22px] rounded-full transition-all flex items-center justify-center",
          disabled ? "border-2 border-neutral-200 bg-neutral-50" :
          selected ? "bg-neutral-900" : "border-2 border-neutral-200 bg-transparent"
        )}>
          {selected && !disabled && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
