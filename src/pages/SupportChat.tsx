import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SupportChatInterface } from "@/components/support/SupportChatInterface";

/**
 * Página de Chat de Suporte em Tela Cheia
 * Design Premium - Estilo ChatGPT/Claude
 */
export default function SupportChat() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Header Premium */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Voltar</span>
          </button>
          <div className="h-6 w-px bg-border/50" />
          <h1 className="text-lg font-semibold text-foreground">Chat de Suporte</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">Online</span>
        </div>
      </header>

      {/* Chat Interface */}
      <SupportChatInterface />
    </div>
  );
}
