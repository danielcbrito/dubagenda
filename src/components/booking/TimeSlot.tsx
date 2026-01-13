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
        "py-4 rounded-xl font-semibold transition-all text-sm",
        isDisabled && "opacity-30 cursor-not-allowed text-zinc-600",
        !isDisabled && !isSelected && "bg-white/[0.02] border border-white/5 text-white hover:bg-white/[0.04] hover:border-white/10",
        isSelected && "bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/25 scale-105 border-0"
      )}
    >
      {time}
    </button>
  );
}
