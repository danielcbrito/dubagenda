import { SupportChatWidget } from "@/components/support/SupportChatWidget";

/**
 * Página completa dedicada ao suporte - Estilo ChatGPT Premium
 * Experiência imersiva em tela cheia
 */
export default function Support() {
  return (
    <div className="h-screen w-full bg-background">
      <SupportChatWidget onClose={() => window.history.back()} fullScreen />
    </div>
  );
}