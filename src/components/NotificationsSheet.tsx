import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  MessageCircleWarning,
} from "lucide-react";
import { BackArrow } from "@/components/ui/back-arrow";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
  agendamento_id: string | null;
}

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

function getNotifIcon(tipo: string, titulo: string) {
  const t = titulo.toLowerCase();
  if (tipo === "whatsapp_desconectado" || t.includes("whatsapp"))
    return <MessageCircleWarning className="w-4 h-4 text-amber-500" />;
  if (tipo === "cancelamento" || tipo === "cancelamento_massa" || t.includes("cancelad"))
    return <XCircle className="w-4 h-4 text-destructive" />;
  if (tipo === "remarcacao" || t.includes("remarc"))
    return <Calendar className="w-4 h-4 text-primary" />;
  if (tipo === "lembrete" || t.includes("lembrete"))
    return <Clock className="w-4 h-4 text-primary" />;
  if (t.includes("concluíd") || t.includes("concluido"))
    return <CheckCircle2 className="w-4 h-4 text-primary" />;
  if (t.includes("confirmad") || t.includes("agendamento"))
    return <CheckCircle className="w-4 h-4 text-primary" />;
  return <Bell className="w-4 h-4 text-muted-foreground" />;
}

function renderMessage(mensagem: string, isCancelamento: boolean) {
  if (!isCancelamento) return mensagem;
  const creditMatch = mensagem.match(/(R\$\s*[\d.,]+)/);
  if (!creditMatch) return mensagem;
  const parts = mensagem.split(creditMatch[1]);
  return (
    <>
      {parts[0]}
      <span className="text-green-400 font-medium">{creditMatch[1]}</span>
      {parts[1]}
    </>
  );
}

function NotificationCard({
  notification,
  onMarkAsRead,
  onReschedule,
  index,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onReschedule: (id: string) => void;
  index: number;
}) {
  const isCancelamento = notification.tipo === "cancelamento" || notification.tipo === "cancelamento_massa";
  const needsAction = notification.tipo === "remarcacao" || isCancelamento;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-xl border p-3.5 active:scale-[0.99] transition-all",
        isCancelamento && "border-l-2 border-l-destructive/50",
        notification.lida
          ? "border-border/20 bg-card/40"
          : "border-border/40 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
          notification.lida ? "bg-muted/50" : "bg-primary/10 dark:bg-primary/15"
        )}>
          {getNotifIcon(notification.tipo, notification.titulo)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h4 className={cn(
              "text-[13px] font-semibold leading-tight",
              notification.lida ? "text-muted-foreground" : "text-foreground"
            )}>
              {notification.titulo}
            </h4>
            {!notification.lida && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
            )}
          </div>

          <p className={cn(
            "text-[11px] leading-relaxed line-clamp-2 mb-2",
            notification.lida ? "text-muted-foreground/50" : "text-muted-foreground"
          )}>
            {renderMessage(notification.mensagem, isCancelamento)}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>

            <div className="flex items-center gap-2">
              {needsAction && (
                <button
                  onClick={(e) => { e.stopPropagation(); onReschedule(notification.id); }}
                  className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-semibold active:opacity-70 transition-opacity"
                >
                  Reagendar
                </button>
              )}
              {!notification.lida && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMarkAsRead(notification.id); }}
                  className="text-[10px] text-muted-foreground/50 active:text-foreground transition-colors"
                >
                  Marcar lida
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function NotificationsSheet({ open, onOpenChange, userId }: NotificationsSheetProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && userId) loadNotifications();
  }, [open, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadNotifications();
          toast.info("Nova notificação recebida!");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const loadNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
      toast.error("Erro ao carregar notificações");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("id", notificationId);
      if (error) throw error;
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, lida: true } : n))
      );
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from("notificacoes")
        .update({ lida: true })
        .eq("user_id", userId)
        .eq("lida", false);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
      toast.success("Todas marcadas como lidas");
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
      toast.error("Erro ao marcar notificações");
    }
  };

  const handleReschedule = (notificationId: string) => {
    markAsRead(notificationId);
    onOpenChange(false);
    navigate("/cliente/agendar");
  };

  const unreadCount = notifications.filter((n) => !n.lida).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: "100%" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          {/* Header */}
          <div className="flex-shrink-0 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onOpenChange(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-card border border-border/40 active:scale-90 transition-transform"
              >
                <BackArrow size={18} className="text-foreground" />
              </button>
              <h1 className="text-[14px] font-semibold text-foreground tracking-tight flex-1">
                Notificações
              </h1>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[11px] text-primary font-semibold active:opacity-70 transition-opacity"
                >
                  Marcar todas
                </button>
              )}
            </div>

            {/* Unread counter */}
            {unreadCount > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2"
              >
                <p className="text-[10px] text-muted-foreground/50">
                  <span className="text-foreground font-bold tabular-nums">{unreadCount}</span> não lida{unreadCount > 1 ? "s" : ""}
                </p>
              </motion.div>
            )}
          </div>

          {/* Scroll area */}
          <div className="flex-1 min-h-0 relative">
            <div
              className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, hsl(var(--background)), transparent)" }}
            />
            <div className="h-full overflow-y-auto overscroll-contain pb-24 px-4 space-y-2.5">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-20 text-center"
                >
                  <div className="w-14 h-14 bg-muted/30 rounded-2xl flex items-center justify-center mb-4">
                    <Bell className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-[13px] font-semibold text-muted-foreground mb-1">
                    Nenhuma notificação
                  </p>
                  <p className="text-[11px] text-muted-foreground/50 max-w-[200px]">
                    Atualizações sobre seus agendamentos aparecerão aqui
                  </p>
                </motion.div>
              ) : (
                notifications.map((notif, index) => (
                  <NotificationCard
                    key={notif.id}
                    notification={notif}
                    onMarkAsRead={markAsRead}
                    onReschedule={handleReschedule}
                    index={index}
                  />
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
