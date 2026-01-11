import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface StoreComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreComingSoonDialog({ open, onOpenChange }: StoreComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-sm bg-gradient-to-b from-zinc-900 to-zinc-950 border-zinc-800">
        <DialogHeader className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30"
          >
            <ShoppingBag className="w-10 h-10 text-white" />
          </motion.div>
          
          <DialogTitle className="text-xl font-bold text-white">
            Loja em Desenvolvimento
          </DialogTitle>
          
          <DialogDescription className="text-zinc-400 text-sm leading-relaxed">
            Estamos preparando novidades incríveis para você! Em breve, produtos exclusivos da Barbearia Dub estarão disponíveis.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-2 py-4 px-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 mt-2"
        >
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-zinc-300">
            Fique ligado para novidades!
          </span>
        </motion.div>

        <Button
          onClick={() => onOpenChange(false)}
          className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-11"
        >
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
