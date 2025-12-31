import { motion } from "framer-motion";
import { Wrench, Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoDub from "@/assets/logo-dub.png";

interface MaintenanceScreenProps {
  message?: string;
  onExit: () => void;
}

export function MaintenanceScreen({ message, onExit }: MaintenanceScreenProps) {
  const defaultMessage = "Estamos realizando melhorias para você. Voltamos em breve!";
  
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center max-w-md"
      >
        {/* Logo */}
        <motion.img
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          src={logoDub}
          alt="Barbearia DUB"
          className="w-32 h-32 object-contain mb-8"
        />

        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, -10, 0] }}
          transition={{ 
            scale: { duration: 0.4, delay: 0.3 },
            rotate: { duration: 0.6, delay: 0.7, ease: "easeInOut" }
          }}
          className="w-24 h-24 rounded-full glass-card flex items-center justify-center mb-8"
          style={{ boxShadow: 'var(--shadow-glow-red)' }}
        >
          <Wrench className="w-12 h-12 text-primary" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-bold text-foreground mb-4"
        >
          Em Manutenção
        </motion.h1>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground text-lg mb-8 leading-relaxed"
        >
          {message || defaultMessage}
        </motion.p>

        {/* Time indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-2 text-muted-foreground mb-10"
        >
          <Clock className="w-5 h-5 animate-pulse" />
          <span className="text-sm">Volte em breve</span>
        </motion.div>

        {/* Exit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Button
            onClick={onExit}
            className="btn-neon px-8 py-4 text-base font-semibold flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Entendi, voltar mais tarde
          </Button>
        </motion.div>
      </motion.div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-6 text-muted-foreground text-xs"
      >
        Agradecemos a compreensão
      </motion.p>
    </div>
  );
}
