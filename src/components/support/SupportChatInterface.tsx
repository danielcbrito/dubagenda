import { ArrowUp, Mic, StopCircle, Loader2 } from "lucide-react";
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
}

export function SupportChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
              setMessages(messagesData.map(msg => ({
                role: msg.role as "user" | "assistant",
                content: msg.content,
                timestamp: new Date(msg.created_at),
              })));
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
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
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
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            const { data, error } = await supabase.functions.invoke("speech-to-text", { body: { audio: base64Audio } });
            if (!error && data?.text) { setInput(data.text); adjustTextareaHeight(); }
          };
        } catch {}
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend) return;

    setMessages(prev => [...prev, { role: "user", content: textToSend, timestamp: new Date() }]);
    setInput("");
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const { data, error } = await supabase.functions.invoke("ai-support-chat", {
        body: { message: textToSend, conversationId, guestName: "Usuário", guestEmail: "guest@example.com" }
      });
      if (error) throw error;
      setMessages(prev => [...prev, { role: "assistant", content: data.response, timestamp: new Date() }]);
      if (data.conversationId && !conversationId) setConversationId(data.conversationId);
    } catch {
      toast.error("Erro ao enviar mensagem.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground/50 animate-spin" />
      </div>
    );
  }

  const hasMessages = messages.length > 0 || isLoading;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages or Welcome */}
      {!hasMessages ? (
        /* Welcome — ultra clean */
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="mb-5 flex justify-center">
              <BotAvatar size="lg" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-1.5">
              Como posso te ajudar?
            </h2>
            <p className="text-[12px] text-muted-foreground/60 max-w-[220px] mx-auto leading-relaxed">
              Pergunte qualquer coisa sobre agendamentos, pagamentos ou sua conta.
            </p>
          </motion.div>
        </div>
      ) : (
        /* Messages */
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-2xl mx-auto px-4 pt-14 pb-4">
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("mb-4", message.role === "user" && "flex justify-end")}
                >
                  {message.role === "user" ? (
                    <div className="max-w-[80%]">
                      <div className="rounded-2xl rounded-br-sm px-3.5 py-2.5 bg-primary text-primary-foreground">
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2.5">
                      <div className="shrink-0 mt-0.5">
                        <BotAvatar size="sm" />
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[13px] leading-[1.75] text-foreground/85 whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5 mb-4">
                <div className="shrink-0 mt-0.5"><BotAvatar size="sm" /></div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Input — minimal, pill-shaped */}
      <div className="shrink-0 px-4 pb-5 pt-2">
        <div className="max-w-xl mx-auto">
          <div className={cn(
            "flex items-end gap-1 px-1.5 py-1 rounded-full transition-all duration-200",
            "bg-card border border-border/60",
            "shadow-soft"
          )}>
            {/* Mic */}
            <button
              type="button"
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                isRecording
                  ? "text-destructive bg-destructive/10"
                  : "text-muted-foreground/40 hover:text-muted-foreground"
              )}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? <StopCircle className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Mensagem..."
              disabled={isLoading}
              className="flex-1 min-h-[32px] max-h-[100px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none leading-tight"
              rows={1}
            />

            {/* Send */}
            <button
              type="button"
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                input.trim()
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground/20 cursor-not-allowed"
              )}
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
