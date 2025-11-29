import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/**
 * Botão flutuante de chat de suporte - Design Premium
 * Ao clicar, abre página de chat em tela cheia
 */
export function SupportChatBubble() {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate('/suporte')}
      className="fixed bottom-6 right-6 z-50 h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white shadow-2xl hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center group overflow-hidden"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5, type: "spring" }}
    >
      {/* Glow Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-2xl"
        animate={{ 
          opacity: [0.5, 0.8, 0.5],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      <div className="relative z-10">
        <MessageCircle className="h-7 w-7" />
        {/* Online Indicator */}
        <motion.div
          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-400 border-2 border-white"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
    </motion.button>
  );
}