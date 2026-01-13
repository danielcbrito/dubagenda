import { ArrowLeft } from "lucide-react";

interface BookingHeaderProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  onBack: () => void;
}

export function BookingHeader({ currentStep, totalSteps, title, onBack }: BookingHeaderProps) {
  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-md">
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-4">
        {/* Header Row */}
        <div className="relative flex items-center justify-center mb-6">
          {/* Voltar */}
          <button 
            onClick={onBack}
            className="absolute left-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Título centralizado */}
          <h1 className="text-xl font-bold text-white tracking-tight">
            {title}
          </h1>
        </div>

        {/* Barra de progresso minimalista */}
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
