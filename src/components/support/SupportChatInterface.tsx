import { Send, Paperclip, Mic, X, Image as ImageIcon, FileText, StopCircle, AlertTriangle, CreditCard, Lock, Bug } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
}

const quickSuggestions = [
  {
    icon: AlertTriangle,
    title: "Problema com agendamento",
    message: "Estou tendo problemas para agendar um horário"
  },
  {
    icon: CreditCard,
    title: "Erro no pagamento",
    message: "Meu pagamento não foi processado corretamente"
  },
  {
    icon: Lock,
    title: "Não consigo acessar",
    message: "Não estou conseguindo acessar minha conta"
  },
  {
    icon: Bug,
    title: "Reportar bug",
    message: "Encontrei um erro no aplicativo"
  }
];

/**
 * Interface Premium 2025 — Ultra Moderna
 * Glassmorphism, animações fluidas, tipografia premium
 */
export function SupportChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());
        
        // Converter áudio para texto
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend && selectedFiles.length === 0) return;

    const userMessage: Message = {
      role: "user",
      content: textToSend,
      timestamp: new Date(),
      attachments: selectedFiles.map(file => ({
        type: file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file",
        url: URL.createObjectURL(file),
        name: file.name
      }))
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSelectedFiles([]);
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

  const renderWelcomeScreen = () => (
    <div className="chat-messages px-4 md:px-6 py-6 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* Mensagem de Boas-vindas com Avatar */}
        <div className="flex gap-4 mb-8 animate-fade-in">
          <BotAvatar size="lg" />
          <div 
            className="flex-1 rounded-3xl px-6 py-5 bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl"
            style={{
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
            }}
          >
            <p className="text-white/90 text-[15px] leading-relaxed font-light">
              Olá! Sou o assistente técnico da Barbearia DUB. Estou aqui para ajudar você a resolver problemas com o aplicativo. Qual dificuldade você está enfrentando?
            </p>
            <p className="text-white/40 text-[11px] mt-2 font-medium">
              Agora
            </p>
          </div>
        </div>

        {/* Sugestões Rápidas Premium */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: "150ms" }}>
          {quickSuggestions.map((suggestion, index) => {
            const Icon = suggestion.icon;
            return (
              <button
                key={index}
                onClick={() => sendMessage(suggestion.message)}
                className="group p-4 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-left hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors duration-300">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-sm font-medium group-hover:text-white transition-colors duration-300">
                      {suggestion.title}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderMessages = () => (
    <div ref={scrollAreaRef} className="chat-messages px-4 md:px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex w-full animate-fade-in gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {/* Avatar do Bot - apenas para mensagens do assistente */}
            {message.role === "assistant" && (
              <BotAvatar size="md" />
            )}
            
            <div
              className={cn(
                "max-w-[80%] md:max-w-[75%] rounded-3xl px-5 py-4 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.01]",
                message.role === "user"
                  ? "bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 backdrop-blur-2xl border border-primary/30 text-white shadow-primary/20"
                  : "bg-white/5 backdrop-blur-2xl border border-white/10 text-white/90 shadow-black/20"
              )}
              style={message.role === "user" ? {
                boxShadow: "0 0 20px rgba(217, 65, 65, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
              } : {
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
              }}
            >
              {/* Attachments Premium */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-3 space-y-2">
                  {message.attachments.map((attachment, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10">
                      {attachment.type === "image" ? (
                        <>
                          <ImageIcon className="h-4 w-4 text-white/60" />
                          <img src={attachment.url} alt={attachment.name} className="max-w-xs rounded-xl shadow-lg" />
                        </>
                      ) : attachment.type === "audio" ? (
                        <>
                          <Mic className="h-4 w-4 text-white/60" />
                          <audio src={attachment.url} controls className="max-w-xs" />
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4 text-white/60" />
                          <span className="text-xs text-white/70">{attachment.name}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Message Content Premium */}
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words font-light">
                {message.content}
              </p>
              
              {/* Timestamp Premium */}
              <p className={cn(
                "text-[11px] mt-2.5 font-medium",
                message.role === "user" ? "text-white/50" : "text-white/40"
              )}>
                {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading State Premium com Avatar */}
        {isLoading && (
          <div className="flex justify-start animate-fade-in gap-3">
            <BotAvatar size="md" />
            <div 
              className="max-w-[75%] rounded-3xl px-5 py-4 bg-white/5 backdrop-blur-2xl border border-white/10"
              style={{
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-white/30 font-light">Analisando sua mensagem...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area - Flex 1 para ocupar todo espaço disponível */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isLoading ? renderWelcomeScreen() : renderMessages()}
      </div>

      {/* Input Area Premium 2025 - Fixo no bottom */}
      <div 
        className="shrink-0 p-3 md:p-4 border-t border-white/5 backdrop-blur-xl"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Selected Files Preview Premium */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 text-sm group hover:bg-white/10 transition-all duration-300">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 text-white/60" />
                  ) : file.type.startsWith("audio/") ? (
                    <Mic className="h-4 w-4 text-white/60" />
                  ) : (
                    <FileText className="h-4 w-4 text-white/60" />
                  )}
                  <span className="text-xs text-white/70 font-medium">{file.name}</span>
                  <button 
                    onClick={() => removeFile(index)} 
                    className="hover:text-red-400 transition-colors duration-200"
                  >
                    <X className="h-3.5 w-3.5 text-white/50" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Container Premium Glassmorphism */}
          <div 
            className="relative flex items-center gap-2 p-2.5 rounded-3xl backdrop-blur-2xl border transition-all duration-300 focus-within:border-primary/50 focus-within:shadow-[0_0_20px_rgba(217,65,65,0.3)]"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)"
            }}
          >
            {/* Attach Button Premium */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Textarea Premium */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1 min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2.5 text-[15px] text-white placeholder:text-white/40 focus:outline-none font-light"
              rows={1}
            />

            {/* Audio Button Premium */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full shrink-0 transition-all duration-300",
                isRecording 
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 animate-pulse" 
                  : "hover:bg-white/10 text-white/60 hover:text-white"
              )}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Send Button Premium com Destaque */}
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              style={{
                background: input.trim() && !isLoading 
                  ? 'linear-gradient(135deg, hsl(0 64% 52%), hsl(0 64% 42%))' 
                  : 'rgba(255, 255, 255, 0.1)',
                boxShadow: input.trim() && !isLoading 
                  ? '0 4px 16px rgba(217, 65, 65, 0.4), 0 0 20px rgba(217, 65, 65, 0.3)' 
                  : 'none'
              }}
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </div>

          {/* Disclaimer Premium */}
          <p className="text-center text-[11px] text-white/30 mt-3 font-light">
            IA pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
}
