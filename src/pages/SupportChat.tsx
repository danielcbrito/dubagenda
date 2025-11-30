import { ArrowLeft, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { SupportChatInterface } from "@/components/support/SupportChatInterface";
import logoImage from "@/assets/logo-dub.png";

/**
 * Chat de Suporte — Interface Premium 2025
 * Design ultra-moderno, minimalista e sofisticado
 */
export default function SupportChat() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/cliente");
  };

  // Lock body scroll on mount, unlock on unmount
  useEffect(() => {
    document.documentElement.classList.add('lock-scroll');
    document.body.classList.add('lock-scroll');
    
    // Dynamic height calculation for mobile browsers
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
      className="w-full flex flex-col overflow-hidden"
      style={{ 
        height: 'calc(var(--vh, 1vh) * 100)',
        width: '100vw',
        background: 'linear-gradient(180deg, #0A0A0A 0%, #141414 100%)'
      }}
    >
      {/* Header Premium com Glassmorphism */}
      <header 
        className="backdrop-blur-2xl border-b border-white/5 px-4 py-3 flex items-center justify-between z-10 shrink-0"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.05)'
        }}
      >
        {/* Botão Voltar */}
        <button
          onClick={handleBack}
          className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-all duration-300"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5 text-white/70" />
        </button>
        
        {/* Logo e Título Centralizados */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <img 
            src={logoImage} 
            alt="Logo" 
            className="h-7 w-7 object-contain"
          />
          <h1 className="text-base font-semibold text-white/90">
            ChatDUB
          </h1>
        </div>

        {/* Botão Menu (3 pontinhos) */}
        <button
          className="h-10 w-10 rounded-full hover:bg-white/10 flex items-center justify-center transition-all duration-300"
          aria-label="Menu"
        >
          <MoreVertical className="h-5 w-5 text-white/70" />
        </button>
      </header>

      {/* Chat Interface - Flex 1 para ocupar todo espaço disponível */}
      <div className="flex-1 overflow-hidden" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <SupportChatInterface />
      </div>
    </div>
  );
}
