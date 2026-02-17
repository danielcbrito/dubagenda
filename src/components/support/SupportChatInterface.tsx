import { ArrowUp, Mic, StopCircle, Loader2, Paperclip, X, Plus, Clock, MessageSquarePlus } from "lucide-react";
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

interface ConversationSummary {
  id: string;
  created_at: string;
  last_message_at: string;
  preview: string;
}

export function SupportChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load user + active conversation
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const { data: convs } = await supabase
            .from('support_conversations')
            .select('id, created_at')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .order('last_message_at', { ascending: false })
            .limit(1);

          if (convs && convs.length > 0) {
            const convId = convs[0].id;
            setConversationId(convId);
            const { data: msgs } = await supabase
              .from('support_messages')
              .select('role, content, created_at')
              .eq('conversation_id', convId)
              .order('created_at', { ascending: true });

            if (msgs && msgs.length > 0) {
              setMessages(msgs.map(m => ({
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.created_at),
              })));
            }
          }
        }
      } catch (e) {
        console.error('Erro ao carregar histórico:', e);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Load conversation history list
  const loadConversationHistory = useCallback(async () => {
    if (!userId) return;
    setLoadingConversations(true);
    try {
      const { data: convs } = await supabase
        .from('support_conversations')
        .select('id, created_at, last_message_at')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(20);

      if (convs) {
        const summaries: ConversationSummary[] = [];
        for (const conv of convs) {
          const { data: firstMsg } = await supabase
            .from('support_messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .eq('role', 'user')
            .order('created_at', { ascending: true })
            .limit(1);

          summaries.push({
            id: conv.id,
            created_at: conv.created_at,
            last_message_at: conv.last_message_at || conv.created_at,
            preview: firstMsg?.[0]?.content?.slice(0, 60) || "Conversa sem mensagem",
          });
        }
        setConversations(summaries);
      }
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    } finally {
      setLoadingConversations(false);
    }
  }, [userId]);

  const openConversation = async (convId: string) => {
    setConversationId(convId);
    setShowHistory(false);
    const { data: msgs } = await supabase
      .from('support_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (msgs) {
      setMessages(msgs.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.created_at),
      })));
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
    toast.success("Nova conversa");
  };

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

  // Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const { data, error } = await supabase.functions.invoke("speech-to-text", { body: { audio: base64 } });
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

  // Files
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Send
  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend && selectedFiles.length === 0) return;

    const content = selectedFiles.length > 0
      ? `${textToSend}\n\n[${selectedFiles.length} arquivo(s) anexado(s): ${selectedFiles.map(f => f.name).join(', ')}]`
      : textToSend;

    setMessages(prev => [...prev, { role: "user", content, timestamp: new Date() }]);
    setInput("");
    setSelectedFiles([]);
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const { data, error } = await supabase.functions.invoke("ai-support-chat", {
        body: { message: content, conversationId, guestName: "Usuário", guestEmail: "guest@example.com" }
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

  const canSend = input.trim() || selectedFiles.length > 0 || isRecording;

  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="w-5 h-5 text-muted-foreground/40 animate-spin" />
      </div>
    );
  }

  const hasMessages = messages.length > 0 || isLoading;

  // Format date for history
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoje";
    if (days === 1) return "Ontem";
    if (days < 7) return `${days} dias atrás`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  return (
    <div className="flex flex-col h-full bg-background">

      {/* History panel overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-background flex flex-col"
          >
            {/* History header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <h3 className="text-[14px] font-semibold text-foreground">Conversas anteriores</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* New conversation button */}
            <div className="px-4 mb-3">
              <button
                onClick={startNewConversation}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-border/60 hover:bg-card/80 transition-colors text-left"
              >
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-medium text-foreground">Nova conversa</span>
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
              {loadingConversations ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-4 h-4 text-muted-foreground/40 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-[12px] text-muted-foreground/50 text-center py-8">Nenhuma conversa ainda</p>
              ) : (
                <div className="space-y-1.5">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv.id)}
                      className={cn(
                        "w-full text-left px-3.5 py-3 rounded-xl transition-colors",
                        "hover:bg-card/80",
                        conv.id === conversationId && "bg-card border border-border/60"
                      )}
                    >
                      <p className="text-[13px] text-foreground/80 truncate leading-tight">{conv.preview}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-1 tabular-nums">{formatDate(conv.last_message_at)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar — always visible */}
      <div className="shrink-0 flex items-center justify-between pl-14 pr-4 pt-3 pb-1">
        <button
          onClick={() => { setShowHistory(true); loadConversationHistory(); }}
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Histórico"
        >
          <Clock className="h-4 w-4" />
        </button>
        <button
          onClick={startNewConversation}
          className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Nova conversa"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Welcome or Messages */}
      {!hasMessages ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <div className="mb-4 flex justify-center">
              <BotAvatar size="lg" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground mb-1">
              Como posso te ajudar?
            </h2>
            <p className="text-[12px] text-muted-foreground/50 leading-relaxed">
              Estou aqui para resolver seu problema.
            </p>
          </motion.div>

        </div>
      ) : (
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-2xl mx-auto px-4 pt-2 pb-4">
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
                      <div className="rounded-2xl rounded-br-sm px-3.5 py-2.5 bg-muted/70 dark:bg-muted/40 text-foreground">
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

      {/* Input area */}
      <div className="shrink-0 px-4 pb-5 pt-2">
        <div className="max-w-xl mx-auto">
          {/* File previews */}
          <AnimatePresence>
            {selectedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="mb-2 flex flex-wrap gap-1.5"
              >
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-muted/50 border border-border/40 text-[11px] text-muted-foreground">
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => removeFile(i)} className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input pill */}
          <div className={cn(
            "flex items-end gap-1 px-1 py-1 rounded-full transition-all duration-200",
            "bg-card border border-border/60",
            "shadow-soft"
          )}>
            {/* Attach file — left side */}
            <button
              type="button"
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />

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

            {/* Mic + Send — right side */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                  isRecording
                    ? "text-destructive bg-destructive/10"
                    : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30"
                )}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
              >
                {isRecording ? <StopCircle className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-200",
                  canSend
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground/20 cursor-not-allowed"
                )}
                onClick={() => sendMessage()}
                disabled={isLoading || !canSend}
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
