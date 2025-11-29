import { Send, Paperclip, Mic, X, Image as ImageIcon, FileText, StopCircle, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const welcomePrompts = [
  "Como faço para agendar um corte?",
  "Quais são os planos disponíveis?",
  "Como funciona o sistema de pontos?",
  "Preciso de ajuda com pagamento"
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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: "audio/webm" });
        setSelectedFiles([audioFile]);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Gravação iniciada");
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast.error("Não foi possível acessar o microfone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Áudio gravado");
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
    <div className="flex-1 flex items-center justify-center p-4 md:p-6">
      <div className="max-w-3xl w-full space-y-10 text-center">
        {/* Logo Premium 2025 */}
        <div className="flex justify-center">
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-primary/40 to-primary/30 blur-3xl rounded-full opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
            
            {/* Icon Container */}
            <div className="relative h-24 w-24 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/10">
              <Sparkles className="h-12 w-12 text-white drop-shadow-2xl" />
            </div>
          </div>
        </div>

        {/* Mensagem de Boas-vindas Premium */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
            Olá! Como posso te ajudar hoje?
          </h1>
          <p className="text-white/60 text-base md:text-lg lg:text-xl font-light max-w-2xl mx-auto leading-relaxed">
            Estou aqui para responder suas dúvidas sobre agendamentos, planos e muito mais.
          </p>
        </div>

        {/* Sugestões Premium */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12">
          {welcomePrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => sendMessage(prompt)}
              className="group relative p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-left hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
              <p className="relative text-sm md:text-base text-white/80 group-hover:text-white font-medium transition-colors duration-300">
                {prompt}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMessages = () => (
    <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex w-full animate-fade-in",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] md:max-w-[75%] rounded-3xl px-5 py-4 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.01]",
                message.role === "user"
                  ? "bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white shadow-primary/20"
                  : "bg-white/5 backdrop-blur-2xl border border-white/10 text-white/90 shadow-black/20"
              )}
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

        {/* Loading State Premium */}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[75%] rounded-3xl px-5 py-4 bg-white/5 backdrop-blur-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-white/60 font-medium">Analisando sua solicitação...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {messages.length === 0 && !isLoading ? renderWelcomeScreen() : renderMessages()}

      {/* Input Area Premium 2025 */}
      <div className="bg-black/20 backdrop-blur-2xl p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
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
          <div className="relative flex items-end gap-2 md:gap-3 p-2 md:p-3 rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl hover:bg-white/10 hover:border-white/20 transition-all duration-300">
            {/* Attach Button Premium */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-2xl shrink-0 hover:bg-white/10 text-white/70 hover:text-white transition-all duration-300 hover:scale-105"
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
              placeholder="Pergunte qualquer coisa..."
              disabled={isLoading}
              className="flex-1 min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-3 text-[15px] text-white placeholder:text-white/40 focus:outline-none font-light"
              rows={1}
            />

            {/* Audio Button Premium */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-11 w-11 rounded-2xl shrink-0 transition-all duration-300 hover:scale-105",
                isRecording 
                  ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 animate-pulse" 
                  : "hover:bg-white/10 text-white/70 hover:text-white"
              )}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Send Button Premium */}
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 rounded-2xl shrink-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 hover:from-primary hover:to-primary/90 text-white shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>

          {/* Helper Text Premium */}
          <p className="text-[11px] text-white/40 text-center mt-3 font-medium">
            <span className="text-white/50">Enter</span> para enviar • <span className="text-white/50">Shift+Enter</span> para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
