import { Send, Bot, User, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const thinkingStates = [
  "Analisando sua solicitação",
  "Processando informações",
  "Avaliando melhor solução",
  "Consultando base de conhecimento",
  "Preparando resposta detalhada"
];

/**
 * Interface de Chat Premium - Estilo ChatGPT
 * Sem emojis, design minimalista e profissional
 */
export function SupportChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Como posso ajudá-lo hoje?\n\nPosso auxiliar com dúvidas sobre agendamentos, pontos de fidelidade, pagamentos ou problemas técnicos.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Rotacionar estados de "pensando"
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setThinkingIndex(prev => (prev + 1) % thinkingStates.length);
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

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      // Verificar se quer criar ticket
      const wantsTicket = trimmedInput.toLowerCase().includes('criar ticket');
      
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('ai-support-chat', {
        body: {
          message: userMessage.content,
          conversationId: conversationId,
          action: wantsTicket ? 'create_ticket' : null,
          guestName: guestName || 'Visitante',
          guestEmail: guestEmail || ''
        },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (error) throw error;

      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.ticketId) {
        toast({
          title: "Chamado Criado",
          description: `Ticket #${data.ticketId.substring(0, 8)} aberto com sucesso.`,
        });
      }

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
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
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages Area */}
      <div 
        className="flex-1 overflow-y-auto px-4 md:px-8 py-8 space-y-6"
        style={{ 
          background: 'linear-gradient(to bottom, hsl(0 0% 2%), hsl(0 0% 4%))',
        }}
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-gradient-to-br from-primary to-primary/80' 
                  : 'bg-gradient-to-br from-card to-card/60 border border-border/50'
              }`}>
                {message.role === 'user' ? (
                  <User className="h-5 w-5 text-white" />
                ) : (
                  <Bot className="h-5 w-5 text-primary" />
                )}
              </div>

              {/* Message */}
              <div className={`max-w-[75%] rounded-2xl px-6 py-4 backdrop-blur-sm ${
                message.role === 'user'
                  ? 'bg-primary/10 border border-primary/20 text-foreground'
                  : 'bg-card/50 border border-border/30 text-foreground'
              }`}>
                <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-3 text-muted-foreground">
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}

          {/* Thinking Indicator */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex gap-4"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-card to-card/60 border border-border/50 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="bg-card/50 border border-border/30 rounded-2xl px-6 py-4 backdrop-blur-sm">
                  <motion.div
                    key={thinkingIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{thinkingStates[thinkingIndex]}...</span>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 bg-card/30 backdrop-blur-xl px-4 md:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1 resize-none rounded-xl bg-background/50 border border-border/50 hover:border-border focus:border-primary/50 px-5 py-4 text-base focus:outline-none transition-all duration-200 min-h-[56px] max-h-32 placeholder:text-muted-foreground"
              rows={1}
              disabled={isLoading}
            />
            <motion.button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center transition-all duration-200"
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </motion.button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-center">
            <span className="font-medium">Enter</span> para enviar • <span className="font-medium">Shift+Enter</span> para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
