import { Send, Bot, User, Loader2, X, Sparkles, Brain, Zap, Target } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface SupportChatWidgetProps {
  onClose: () => void;
  fullScreen?: boolean;
}

const thinkingMessages = [
  { icon: "💭", text: "Pensando..." },
  { icon: "🔍", text: "Analisando seu problema..." },
  { icon: "⚡", text: "Processando solução..." },
  { icon: "🧠", text: "Pensando mais a fundo..." },
  { icon: "🎯", text: "Avaliando a melhor resposta..." },
  { icon: "✨", text: "Preparando resposta..." },
];

/**
 * Widget de chat de suporte com IA - Estilo ChatGPT Premium
 * Pode ser usado como pop-up ou página completa
 */
export function SupportChatWidget({ onClose, fullScreen = false }: SupportChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '👋 Olá! Sou a assistente virtual da Barbearia DUB. Como posso te ajudar hoje?\n\n💡 Posso te ajudar com:\n• Fazer agendamento\n• Ver seus pontos de fidelidade\n• Tirar dúvidas sobre pagamento\n• Reportar problema técnico',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Auto scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Rotacionar mensagens de "pensando"
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setThinkingMessageIndex(prev => (prev + 1) % thinkingMessages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]);

  const sendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };

    // Adicionar mensagem do usuário imediatamente
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Resetar altura do textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      // Verificar se usuário quer criar ticket
      const wantsTicket = trimmedInput.toLowerCase().includes('criar ticket') || 
                          trimmedInput.toLowerCase().includes('falar com humano') ||
                          trimmedInput.toLowerCase().includes('falar com atendente');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para usar o chat');
      }

      const { data, error } = await supabase.functions.invoke('ai-support-chat', {
        body: {
          message: userMessage.content,
          conversationId: conversationId,
          action: wantsTicket ? 'create_ticket' : null
        }
      });

      if (error) throw error;

      // Atualizar ID da conversa se for a primeira mensagem
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Se criou ticket, mostrar toast
      if (data.ticketId) {
        toast({
          title: "✅ Ticket Criado!",
          description: `Ticket #${data.ticketId.substring(0, 8)} criado com sucesso!`,
        });
      }

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: '😔 Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente ou entre em contato diretamente com nosso suporte.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);

      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
  };

  const containerClass = fullScreen 
    ? "h-screen w-full bg-background flex flex-col"
    : "w-[420px] h-[680px] bg-card border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col";

  return (
    <div className={containerClass}>
      {/* Header Premium */}
      <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6 border-b border-border/50 backdrop-blur-xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.div 
            className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg"
            animate={{ rotate: [0, 5, 0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Bot className="h-7 w-7 text-white" />
            <motion.div
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.div>
          <div>
            <h3 className="font-bold text-lg text-foreground">Suporte DUB</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              IA • Sempre online
            </p>
          </div>
        </div>
        {!fullScreen && (
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scroll-smooth" 
        style={{ 
          background: 'linear-gradient(to bottom, transparent, rgba(239, 68, 68, 0.02))',
        }}
      >
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
              message.role === 'user' 
                ? 'bg-gradient-to-br from-primary to-primary/80' 
                : 'bg-gradient-to-br from-muted to-muted/60'
            }`}>
              {message.role === 'user' ? (
                <User className="h-5 w-5 text-white" />
              ) : (
                <Bot className="h-5 w-5 text-primary" />
              )}
            </div>

            {/* Message Bubble */}
            <div className={`max-w-[80%] rounded-2xl px-5 py-4 shadow-lg ${
              message.role === 'user'
                ? 'bg-gradient-to-br from-primary to-primary/90 text-white'
                : 'bg-card border border-border/50 text-foreground'
            }`}>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-muted-foreground'}`}>
                {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}

        {/* AI Thinking Indicator */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex gap-4"
            >
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center shadow-md">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div className="bg-card border border-border/50 rounded-2xl px-5 py-4 shadow-lg">
                <motion.div
                  key={thinkingMessageIndex}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground italic"
                >
                  <span className="text-lg">{thinkingMessages[thinkingMessageIndex].icon}</span>
                  <span>{thinkingMessages[thinkingMessageIndex].text}</span>
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ...
                  </motion.span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area Premium */}
      <div className="p-6 border-t border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            placeholder="Digite sua mensagem..."
            className="flex-1 resize-none rounded-2xl bg-background border-2 border-border hover:border-primary/30 focus:border-primary/50 px-5 py-4 text-[15px] focus:outline-none transition-all duration-200 min-h-[56px] max-h-32"
            rows={1}
            disabled={isLoading}
          />
          <motion.button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center transition-all duration-200"
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Send className="h-6 w-6" />
            )}
          </motion.button>
        </div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xs text-muted-foreground mt-3 text-center"
        >
          💡 <span className="font-medium">Enter</span> para enviar • <span className="font-medium">Shift+Enter</span> para nova linha
        </motion.p>
      </div>
    </div>
  );
}