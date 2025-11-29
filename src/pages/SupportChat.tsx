import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

  return (
    <div className="h-screen w-full flex flex-col bg-gradient-to-b from-[#0A0A0A] to-[#0F0F0F] overflow-hidden">
      {/* Header Premium Ultra-Minimalista */}
      <header className="bg-black/30 backdrop-blur-2xl px-4 lg:px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          {/* Botão Voltar Premium */}
          <button
            onClick={handleBack}
            className="group flex items-center gap-2 text-white/60 hover:text-white transition-all duration-300"
            aria-label="Voltar"
          >
            <div className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all duration-300 group-hover:scale-105">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="font-medium text-sm hidden sm:inline">Voltar</span>
          </button>
          
          {/* Logo do Cliente */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <img 
                src={logoImage} 
                alt="Logo" 
                className="relative h-8 w-8 object-contain drop-shadow-2xl"
              />
            </div>
            <h1 className="text-base font-semibold text-white tracking-tight hidden sm:inline">
              Assistente IA
            </h1>
          </div>
        </div>
        
        {/* Status Online */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5">
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-400/30 blur-md rounded-full animate-pulse" />
            <div className="relative h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs text-white/70 font-medium hidden sm:inline">Online</span>
        </div>
      </header>

      {/* Chat Interface */}
      <SupportChatInterface />
    </div>
  );
}
