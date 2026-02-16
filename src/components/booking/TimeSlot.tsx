import { cn } from "@/lib/utils";

interface TimeSlotProps {
  time: string;
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: () => void;
}

export function TimeSlot({ time, isSelected, isDisabled, onSelect }: TimeSlotProps) {
  return (
    <button
      onClick={onSelect}
      disabled={isDisabled}
      className={cn(
        "py-3 rounded-xl font-medium transition-all text-[14px] border tabular-nums",
        "active:scale-[0.97]",
        isDisabled && "opacity-25 cursor-not-allowed",
        isSelected
          ? "bg-primary text-primary-foreground border-primary shadow-[0_2px_12px_hsl(var(--primary)/0.2)]"
          : "bg-card border-border/40 text-foreground hover:border-border"
      )}
    >
      {time}
    </button>
  );
}