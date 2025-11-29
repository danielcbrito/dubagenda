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
    <div className="h-screen w-full flex flex-col bg-[#212121] overflow-hidden">
      {/* Header ChatGPT Style */}
      <header className="bg-[#212121] border-b border-white/10 px-3 py-2.5 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          {/* Menu Button */}
          <button
            onClick={handleBack}
            className="h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
            aria-label="Menu"
          >
            <ArrowLeft className="h-5 w-5 text-white/70" />
          </button>
          
          {/* Logo */}
          <img 
            src={logoImage} 
            alt="Logo" 
            className="h-6 w-6 object-contain"
          />
          
          {/* Title */}
          <h1 className="text-sm font-medium text-white/90">
            ChatDUB
          </h1>
        </div>
      </header>

      {/* Chat Interface */}
      <SupportChatInterface />
    </div>
  );
}
