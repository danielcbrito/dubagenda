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
        isDisabled && "opacity-35 cursor-not-allowed",
        isSelected
          ? "bg-neutral-900 text-white border-transparent shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          : "bg-white border border-neutral-200/80 text-neutral-800 shadow-xs hover:border-neutral-300 active:bg-neutral-50"
      )}
    >
      {time}
    </button>
  );
}