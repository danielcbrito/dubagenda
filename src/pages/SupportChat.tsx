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
    const html = document.documentElement;
    const body = document.body;

    html.classList.add("lock-scroll");
    body.classList.add("lock-scroll");

    const setFullHeight = () => {
      const vh = window.innerHeight * 0.01;
      html.style.setProperty("--vh", `${vh}px`);
    };

    setFullHeight();
    window.addEventListener("resize", setFullHeight);

    return () => {
      html.classList.remove("lock-scroll");
      body.classList.remove("lock-scroll");
      html.style.removeProperty("overflow");
      body.style.removeProperty("overflow");
      html.style.removeProperty("overscroll-behavior");
      body.style.removeProperty("overscroll-behavior");
      window.removeEventListener("resize", setFullHeight);
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
      {/* Botão voltar — integrado no header do chat */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        onClick={handleBack}
        className="absolute top-3 left-3 z-20 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/40 active:scale-95 transition-all"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={1.8} />
      </motion.button>

      {/* Chat Interface */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <SupportChatInterface />
      </div>
    </div>
  );
}
