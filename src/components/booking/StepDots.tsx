import { cn } from "@/lib/utils";

interface StepDotsProps {
  currentStep: number;
  totalSteps: number;
}

export function StepDots({ currentStep, totalSteps }: StepDotsProps) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        
        return (
          <div
            key={stepNumber}
            className={cn(
              "h-[3.5px] rounded-full transition-all duration-300",
              isCurrent 
                ? "w-6 bg-[#18181B]" 
                : isCompleted 
                  ? "w-3 bg-neutral-800" 
                  : "w-2.5 bg-neutral-300"
            )}
          />
        );
      })}
    </div>
  );
}
