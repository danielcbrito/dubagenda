interface SummaryRowProps {
  label: string;
  value: string;
}

export function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-base font-semibold text-white text-right">
        {value}
      </span>
    </div>
  );
}
