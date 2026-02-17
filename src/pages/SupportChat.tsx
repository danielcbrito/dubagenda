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
      {/* Botão voltar — discreto */}
      <motion.button
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onClick={handleBack}
        className="absolute top-4 left-4 z-20 h-9 w-9 rounded-xl bg-card/60 border border-border/50 hover:bg-card flex items-center justify-center transition-all duration-200"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
      </motion.button>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <SupportChatInterface />
      </div>
    </div>
  );
}
