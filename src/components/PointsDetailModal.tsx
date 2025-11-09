import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gift, CheckCircle, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PointsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  points: number;
  completedAppointments: number;
  redemptions: number;
}

export function PointsDetailModal({ 
  open, 
  onOpenChange, 
  points, 
  completedAppointments, 
  redemptions 
}: PointsDetailModalProps) {
  const currentCycleProgress = points % 5;
  const cutsUntilFree = 5 - currentCycleProgress;
  const progressPercentage = (currentCycleProgress / 5) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Gift className="w-5 h-5 text-gold" />
            Programa de Pontos
          </DialogTitle>
          <DialogDescription className="text-xs">
            Seus benefícios e progresso no programa de fidelidade
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">Progresso Atual</h4>
              <span className="text-xs text-muted-foreground">
                {currentCycleProgress} de 5 cortes
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              Faltam <span className="font-semibold text-primary">{cutsUntilFree}</span> {cutsUntilFree === 1 ? 'corte' : 'cortes'} para ganhar 1 grátis
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-primary/5 rounded-lg p-3 text-center space-y-1">
              <CheckCircle className="w-5 h-5 mx-auto text-primary" />
              <p className="text-xl font-bold">{completedAppointments}</p>
              <p className="text-[10px] text-muted-foreground">Cortes realizados</p>
            </div>

            <div className="bg-gold/10 rounded-lg p-3 text-center space-y-1">
              <Gift className="w-5 h-5 mx-auto text-gold" />
              <p className="text-xl font-bold text-gold">{redemptions}</p>
              <p className="text-[10px] text-muted-foreground">Disponíveis</p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-3 text-center space-y-1">
              <Clock className="w-5 h-5 mx-auto text-foreground" />
              <p className="text-xl font-bold">{points}</p>
              <p className="text-[10px] text-muted-foreground">Pontos totais</p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-xs font-semibold">Como funciona?</h4>
            <ul className="space-y-1 text-[10px] text-muted-foreground">
              <li>• A cada corte válido, você ganha 1 ponto</li>
              <li>• Ao completar 5 pontos, ganhe 1 corte grátis</li>
              <li>• Use seus resgates disponíveis no próximo agendamento</li>
              <li>• Resgates não utilizados não expiram</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
