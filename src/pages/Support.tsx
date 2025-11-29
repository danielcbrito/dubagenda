import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";

/**
 * Página completa dedicada ao suporte
 * Acessível via menu "Suporte / Fale Conosco"
 */
export default function Support() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="h-10 w-10 rounded-full hover:bg-primary/10 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Suporte e Ajuda</h1>
            <p className="text-sm text-muted-foreground">
              Chat com IA • Respostas instantâneas
            </p>
          </div>
        </div>
      </div>

      {/* Chat Widget em tela cheia */}
      <div className="h-[calc(100vh-80px)]">
        <SupportChatWidget onClose={() => navigate(-1)} fullScreen />
      </div>
    </div>
  );
}