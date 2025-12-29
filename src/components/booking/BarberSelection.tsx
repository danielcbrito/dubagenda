import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Check, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Barbeiro {
  id: string;
  apelido: string;
  foto_url: string | null;
}

interface BarberSelectionProps {
  barbeiros: Barbeiro[];
  selectedBarbeiroId: string | null;
  onSelect: (barbeiroId: string) => void;
}

export function BarberSelection({ barbeiros, selectedBarbeiroId, onSelect }: BarberSelectionProps) {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-foreground">Escolha seu Barbeiro</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o profissional de sua preferência
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {barbeiros.map((barbeiro) => {
          const isSelected = selectedBarbeiroId === barbeiro.id;
          const initials = barbeiro.apelido?.slice(0, 2).toUpperCase() || 'BB';

          return (
            <Card
              key={barbeiro.id}
              onClick={() => onSelect(barbeiro.id)}
              className={cn(
                "relative cursor-pointer transition-all duration-300 overflow-hidden",
                "hover:scale-[1.02] hover:shadow-lg",
                "bg-card/50 border-border/50",
                isSelected && "ring-2 ring-primary border-primary shadow-[0_0_20px_rgba(255,59,59,0.3)]"
              )}
            >
              {/* Indicador de seleção */}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              <div className="p-4 flex flex-col items-center text-center space-y-3">
                {/* Avatar */}
                <div className="relative">
                  <Avatar className={cn(
                    "h-20 w-20 sm:h-24 sm:w-24 border-2 transition-all duration-300",
                    isSelected ? "border-primary" : "border-border/50"
                  )}>
                    <AvatarImage 
                      src={barbeiro.foto_url || undefined} 
                      alt={barbeiro.apelido}
                      className="object-cover"
                    />
                    <AvatarFallback className={cn(
                      "text-xl sm:text-2xl transition-colors duration-300",
                      isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Glow effect quando selecionado */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl -z-10" />
                  )}
                </div>

                {/* Nome */}
                <span className={cn(
                  "font-medium text-sm sm:text-base transition-colors duration-300",
                  isSelected ? "text-primary" : "text-foreground"
                )}>
                  {barbeiro.apelido}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {barbeiros.length === 0 && (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum barbeiro disponível</p>
        </div>
      )}
    </div>
  );
}
