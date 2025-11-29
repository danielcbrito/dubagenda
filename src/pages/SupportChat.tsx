import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SupportChatInterface } from "@/components/support/SupportChatInterface";

/**
 * Página de Chat de Suporte - Design Premium ChatGPT Style
 */
export default function SupportChat() {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/cliente");
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Header Premium Minimalista */}
      <header className="border-b border-border/30 bg-background/95 backdrop-blur-xl px-4 lg:px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium hidden sm:inline">Voltar</span>
          </button>
          
          <div className="h-5 w-px bg-border/50 hidden sm:block" />
          
          {/* Logo Premium */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>
            <h1 className="text-base font-semibold text-foreground">Assistente IA</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/30 blur-sm rounded-full animate-pulse" />
            <div className="relative h-2 w-2 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">Online</span>
        </div>
      </header>

      {/* Chat Interface */}
      <SupportChatInterface />
    </div>
  );
}
