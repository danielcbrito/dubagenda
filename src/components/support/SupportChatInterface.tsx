import { Send, Paperclip, Mic, X, Image as ImageIcon, FileText, StopCircle } from "lucide-react";
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
 * Interface Premium Estilo ChatGPT
 * Design moderno, sem avatares, com suporte a arquivos e áudio
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
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-8 text-center animate-fade-in">
        {/* Logo Premium */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-2xl shadow-primary/20">
              <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Mensagem de Boas-vindas */}
        <div className="space-y-3">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Olá! Como posso te ajudar hoje?
          </h2>
          <p className="text-muted-foreground text-base lg:text-lg">
            Estou aqui para responder suas dúvidas sobre agendamentos, planos e muito mais.
          </p>
        </div>

        {/* Sugestões de Prompts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8">
          {welcomePrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => sendMessage(prompt)}
              className="group p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/30 transition-all duration-200 text-left hover:scale-[1.02]"
            >
              <p className="text-sm text-foreground/90 group-hover:text-foreground">
                {prompt}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMessages = () => (
    <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
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
                "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                message.role === "user"
                  ? "bg-gradient-to-br from-primary to-primary/80 text-white ml-auto"
                  : "bg-card/60 backdrop-blur-sm border border-border/50 text-foreground"
              )}
            >
              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mb-2 space-y-2">
                  {message.attachments.map((attachment, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-background/30">
                      {attachment.type === "image" ? (
                        <>
                          <ImageIcon className="h-4 w-4" />
                          <img src={attachment.url} alt={attachment.name} className="max-w-xs rounded" />
                        </>
                      ) : attachment.type === "audio" ? (
                        <>
                          <Mic className="h-4 w-4" />
                          <audio src={attachment.url} controls className="max-w-xs" />
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          <span className="text-xs">{attachment.name}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Message Content */}
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
              
              {/* Timestamp */}
              <p className={cn(
                "text-xs mt-2",
                message.role === "user" ? "text-white/60" : "text-muted-foreground"
              )}>
                {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-card/60 backdrop-blur-sm border border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-muted-foreground">Analisando sua solicitação...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-background to-background/95">
      {messages.length === 0 && !isLoading ? renderWelcomeScreen() : renderMessages()}

      {/* Input Area - Estilo ChatGPT */}
      <div className="border-t border-border/30 bg-background/95 backdrop-blur-xl p-4">
        <div className="max-w-3xl mx-auto">
          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-border/50 text-sm">
                  {file.type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  ) : file.type.startsWith("audio/") ? (
                    <Mic className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs text-foreground">{file.name}</span>
                  <button onClick={() => removeFile(index)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Container */}
          <div className="relative flex items-end gap-2 p-2 rounded-3xl bg-card/40 border border-border/50 shadow-lg backdrop-blur-sm hover:border-border transition-all duration-200">
            {/* Attach Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 hover:bg-accent"
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

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Pergunte qualquer coisa..."
              disabled={isLoading}
              className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none"
              rows={1}
            />

            {/* Audio Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full shrink-0 hover:bg-accent",
                isRecording && "bg-destructive hover:bg-destructive text-white"
              )}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            {/* Send Button */}
            <Button
              type="button"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all duration-200"
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && selectedFiles.length === 0)}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>

          {/* Helper Text */}
          <p className="text-xs text-muted-foreground/60 text-center mt-2">
            Pressione Enter para enviar, Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
  );
}
