import { Send, Mic, X, Image as ImageIcon, FileText, StopCircle, ArrowUp, Sparkles, RefreshCw, Loader2, Calendar, CreditCard, Shield, HelpCircle } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { BotAvatar } from "./BotAvatar";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: Array<{
    type: "image" | "file" | "audio";
    url: string;
    name: string;
  }>;
  isAction?: boolean;
  actionType?: "loading" | "success" | "error";
}

const quickSuggestions = [
  {
    icon: Calendar,
    title: "Agendamento",
    description: "Problemas para agendar",
    message: "Estou tendo problemas para agendar um horário"
  },
  {
    icon: CreditCard,
    title: "Pagamento",
    description: "Erro no pagamento",
    message: "Meu pagamento não foi processado corretamente"
  },
  {
    icon: Shield,
    title: "Minha conta",
    description: "Acesso ou segurança",
    message: "Não estou conseguindo acessar minha conta"
  },
  {
    icon: HelpCircle,
    title: "Outro problema",
    description: "Preciso de ajuda",
    message: "Preciso de ajuda com outro assunto"
  }
];

/**
 * Chat IA Premium — Design inspirado no ChatGPT
 * Layout limpo, sem bolhas no assistente, input centralizado
 */
export function SupportChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Carregar usuário e histórico
  useEffect(() => {
    const loadUserAndHistory = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: conversations } = await supabase
            .from('support_conversations')
            .select('id, created_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('last_message_at', { ascending: false })
            .limit(1);

          if (conversations && conversations.length > 0) {
            const convId = conversations[0].id;
            setConversationId(convId);
            const { data: messagesData } = await supabase
              .from('support_messages')
              .select('role, content, created_at, metadata')
              .eq('conversation_id', convId)
              .order('created_at', { ascending: true });

            if (messagesData && messagesData.length > 0) {
              const loadedMessages: Message[] = messagesData.map(msg => {
                const metadata = msg.metadata as Record<string, any> | null;
                return {
                  role: msg.role as "user" | "assistant",
                  content: msg.content,
                  timestamp: new Date(msg.created_at),
                  isAction: metadata?.isAction || false,
                  actionType: metadata?.actionType
                };
              });
              setMessages(loadedMessages);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao carregar histórico:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadUserAndHistory();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        await convertAudioToText(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Ouvindo...");
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const convertAudioToText = async (audioBlob: Blob) => {
    try {
      toast.info("Convertendo áudio em texto...");
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const { data, error } = await supabase.functions.invoke("speech-to-text", {
          body: { audio: base64Audio }
        });
        if (error) throw error;
        if (data?.text) {
          setInput(data.text);
          toast.success("Mensagem transcrita");
          adjustTextareaHeight();
        }
      };
    } catch (error) {
      console.error("Erro ao converter áudio:", error);
      toast.error("Erro ao converter áudio em texto");
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend) return;

    const userMessage: Message = {
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const { data, error } = await supabase.functions.invoke("ai-support-chat", {
        body: {
          message: textToSend,
          conversationId,
          guestName: "Usuário",
          guestEmail: "guest@example.com"
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewConversation = useCallback(async () => {
    setMessages([]);
    setConversationId(null);
    toast.success("Nova conversa iniciada");
  }, []);

  // Loading
  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-[13px]">Carregando histórico...</p>
        </motion.div>
      </div>
    );
  }

  // Welcome Screen — ChatGPT style
  const renderWelcomeScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pb-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-sm"
      >
        {/* Avatar central */}
        <div className="mb-6 flex flex-col items-center">
          <BotAvatar size="lg" />
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-500/80 uppercase tracking-wider">Online agora</span>
          </div>
        </div>

        <h2 className="text-xl font-display font-semibold text-foreground mb-2">
          Como posso te ajudar?
        </h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-8">
          Tenho acesso aos seus dados e posso resolver a maioria dos problemas automaticamente.
        </p>
      </motion.div>

      {/* Sugestões rápidas — grid 2x2 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        <div className="grid grid-cols-2 gap-2.5">
          {quickSuggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                onClick={() => sendMessage(suggestion.message)}
                className="group p-3.5 rounded-xl border border-border/60 hover:border-border bg-card/40 hover:bg-card/80 transition-all duration-200 text-left active:scale-[0.98]"
              >
                <div className="p-1.5 rounded-lg bg-muted/50 w-fit mb-2.5 group-hover:bg-primary/10 transition-colors">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-[13px] font-medium text-foreground/80 group-hover:text-foreground leading-tight">
                  {suggestion.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {suggestion.description}
                </p>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );

  // Mensagens — estilo ChatGPT (sem bolha para assistente)
  const renderMessages = () => (
    <div ref={scrollAreaRef} className="flex-1 overflow-y-auto overscroll-contain">
      {/* Nova conversa */}
      {messages.length > 0 && (
        <div className="sticky top-0 z-10 py-2.5 flex justify-center bg-gradient-to-b from-background via-background/95 to-transparent">
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={startNewConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 hover:border-border bg-card/60 hover:bg-card text-muted-foreground hover:text-foreground text-[11px] font-medium transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Nova conversa
          </motion.button>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-1">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "py-3",
                message.role === "assistant" && "py-4"
              )}
            >
              {message.role === "user" ? (
                /* Mensagem do usuário — bolha alinhada à direita */
                <div className="flex justify-end">
                  <div className="max-w-[80%]">
                    <div className="rounded-2xl rounded-br-md px-4 py-2.5 bg-primary text-primary-foreground">
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 text-right mt-1 pr-1 tabular-nums">
                      {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ) : (
                /* Mensagem do assistente — estilo ChatGPT, sem bolha */
                <div className="flex gap-3">
                  <div className="shrink-0 mt-0.5">
                    <BotAvatar size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] leading-[1.7] text-foreground/90 whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 mt-1.5 tabular-nums">
                      {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 py-4"
          >
            <div className="shrink-0 mt-0.5">
              <BotAvatar size="sm" />
            </div>
            <div className="flex items-center gap-2 py-1">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[12px] text-muted-foreground/50">Analisando...</span>
            </div>
          </motion.div>
        )}

        {/* Spacer para scroll */}
        <div className="h-4" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full relative bg-background">
      {/* Conteúdo */}
      {messages.length === 0 && !isLoading ? renderWelcomeScreen() : renderMessages()}

      {/* Input — estilo ChatGPT, centralizado embaixo */}
      <div className="shrink-0 px-4 pb-5 pt-1">
        <div className="max-w-2xl mx-auto">
          <motion.div
            animate={{
              borderColor: isFocused
                ? "hsl(var(--ring) / 0.4)"
                : "hsl(var(--border) / 0.6)"
            }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative flex items-end gap-1.5 p-1.5 rounded-2xl transition-all duration-200",
              "bg-card/60 border backdrop-blur-sm",
              "shadow-soft"
            )}
          >
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Escreva sua mensagem..."
              disabled={isLoading}
              className="flex-1 min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-tight"
              rows={1}
            />

            {/* Actions */}
            <div className="flex items-center gap-1 pb-0.5 pr-0.5">
              {/* Mic */}
              <button
                type="button"
                className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
                  isRecording
                    ? "bg-destructive/20 text-destructive"
                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50"
                )}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
              >
                {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              {/* Send */}
              <button
                type="button"
                className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
                  input.trim()
                    ? "bg-foreground text-background hover:opacity-90"
                    : "bg-muted/50 text-muted-foreground/30 cursor-not-allowed"
                )}
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>

          {/* Disclaimer sutil */}
          <p className="text-[10px] text-muted-foreground/30 text-center mt-2.5">
            IA com acesso aos seus dados para resolver problemas
          </p>
        </div>
      </div>
    </div>
  );
}
