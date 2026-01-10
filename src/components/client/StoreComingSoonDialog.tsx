import { Construction, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StoreComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreComingSoonDialog({ open, onOpenChange }: StoreComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border/50 bg-card p-0 overflow-hidden">
        {/* Gradient background */}
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            background: "radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.15), transparent 60%)",
          }}
        />

        <div className="relative p-6 text-center">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <Construction className="w-10 h-10 text-primary" />
          </motion.div>

          {/* Title */}
          <DialogHeader className="mb-3">
            <DialogTitle className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Loja em Desenvolvimento
              <Sparkles className="w-5 h-5 text-primary" />
            </DialogTitle>
          </DialogHeader>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Estamos preparando novidades incríveis para você! Em breve, produtos exclusivos 
            estarão disponíveis aqui.
          </p>

          {/* Button */}
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full h-12 rounded-xl font-semibold"
          >
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
