import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { SupportChatInterface } from "@/components/support/SupportChatInterface";
import { motion } from "framer-motion";

/**
 * Chat de Suporte — Interface Premium
 * Tela cheia, limpa, sem distrações
 */
export default function SupportChat() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/cliente");
  };

  useEffect(() => {
    document.documentElement.classList.add('lock-scroll');
    document.body.classList.add('lock-scroll');
    
    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setFullHeight();
    window.addEventListener('resize', setFullHeight);
    
    return () => {
      document.documentElement.classList.remove('lock-scroll');
      document.body.classList.remove('lock-scroll');
      window.removeEventListener('resize', setFullHeight);
    };
  }, []);

  return (
    <div
      className="w-full flex flex-col overflow-hidden relative bg-background"
      style={{ 
        height: 'calc(var(--vh, 1vh) * 100)',
        width: '100vw',
      }}
    >
      {/* Botão voltar — limpo, sem caixa */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        onClick={handleBack}
        className="absolute top-3.5 left-3.5 z-20 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
      </motion.button>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <SupportChatInterface />
      </div>
    </div>
  );
}
