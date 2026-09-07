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
          className="fixed right-4 z-40 flex items-center gap-2.5 h-11 pl-3.5 pr-4 rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-neutral-200/60 active:scale-95 transition-transform"
          style={{
            bottom: "calc(7rem + env(safe-area-inset-bottom, 0px))",
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.3, type: "spring" }}
        >
          <div className="relative flex items-center justify-center">
            <Headphones className="h-5 w-5 text-neutral-800" strokeWidth={2.0} />
            <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <span className="text-[13px] font-semibold text-neutral-800 tracking-tight">
            Suporte
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
