import { Headphones } from "lucide-react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/** Rotas onde o botão APARECE */
const VISIBLE_ROUTES = ["/cliente", "/cliente/perfil"];

const WHATSAPP_NUMBER = "5511963390043";
const WHATSAPP_MESSAGE = encodeURIComponent("Olá, sou cliente e preciso de suporte.");

/**
 * Botão flutuante de suporte — redireciona direto pro WhatsApp
 */
export function SupportChatBubble() {
  const location = useLocation();

  const isVisible = VISIBLE_ROUTES.includes(location.pathname);

  const handleClick = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`, "_blank");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          key="support-bubble"
          onClick={handleClick}
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.65rem)] right-4 z-40 flex items-center gap-2 h-10 pl-3 pr-3.5 rounded-full bg-foreground text-background shadow-md shadow-foreground/10 active:scale-95 transition-transform"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.3, type: "spring" }}
        >
          <div className="relative">
            <Headphones className="h-4 w-4" />
            <div className="absolute -top-0.5 -right-0.5 h-[7px] w-[7px] rounded-full bg-emerald-400 border-[1.5px] border-foreground" />
          </div>

          <span className="text-[11px] font-semibold tracking-wide">
            Suporte
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
