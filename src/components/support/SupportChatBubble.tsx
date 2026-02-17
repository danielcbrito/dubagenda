import { Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/**
 * Botão flutuante de suporte — Design Premium Compacto
 */
export function SupportChatBubble() {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate('/suporte')}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 h-12 pl-3.5 pr-4 rounded-full bg-foreground text-background shadow-lg hover:shadow-xl transition-all duration-300"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5, type: "spring" }}
    >
      {/* Icon */}
      <div className="relative">
        <Headphones className="h-[18px] w-[18px]" />
        {/* Online dot */}
        <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-foreground" />
      </div>
      
      {/* Label */}
      <span className="text-[12px] font-semibold tracking-wide">
        Ajuda
      </span>
    </motion.button>
  );
}
