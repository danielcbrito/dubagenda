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
              "rounded-full transition-all duration-300",
              isCompleted && "w-1.5 h-1.5 bg-primary/60",
              isCurrent && "w-5 h-1.5 bg-primary",
              !isCompleted && !isCurrent && "w-1.5 h-1.5 bg-muted-foreground/15"
            )}
          />
        );
      })}
    </div>
  );
}
