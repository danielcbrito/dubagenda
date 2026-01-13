import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  duracao_minutos: number;
  preco: number;
}

interface ServiceCardProps {
  service: Service;
  isSelected: boolean;
  onToggle: () => void;
}

export function ServiceCard({ service, isSelected, onToggle }: ServiceCardProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full text-left rounded-2xl p-5 transition-all duration-200",
        "border",
        isSelected 
          ? "bg-primary/5 border-primary/50 shadow-lg shadow-primary/10" 
          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Conteúdo */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">
            {service.nome}
          </h3>
          {service.descricao && (
            <p className="text-sm text-zinc-400 mb-3 leading-relaxed">
              {service.descricao}
            </p>
          )}
          
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-500">
              {service.duracao_minutos} min
            </span>
            <span className="text-primary font-semibold">
              R$ {service.preco.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* Checkbox customizado */}
        <div className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center mt-0.5",
          isSelected 
            ? "bg-primary border-primary" 
            : "border-white/20"
        )}>
          {isSelected && (
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          )}
        </div>
      </div>
    </button>
  );
}
