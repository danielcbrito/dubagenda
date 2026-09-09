import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Hook que gerencia notificações do navegador (push-like) + som
 * para o cliente receber alertas mesmo com o app em segundo plano.
 */
export function useNotificationManager(userId: string | null) {
  const permissionRef = useRef<NotificationPermission>("default");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Criar elemento de áudio para o som de notificação
  useEffect(() => {
    // Usa um som curto e premium — tom suave de "ding"
    const audio = new Audio();
    // Data URI de um som curto de notificação (ping suave)
    audio.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAgICAgICAgICAgICAgICBgYKDhIaIi42QkpWXmpyen6KkpqmrrK6wsrO1tre4ubq7u7y8vLy8u7u6ubi3tbSysK6sq6mnpKKfnZqXlJKPjYqIhYOBgH9+fXx7enp5eXl5eXp6e3x9fn+AgYOEhoiKjI+RlJaZm56goqSnqautrrCys7W2uLm6u7y8vLy8vLu7urm4trWzsrCurKqopaOhn5yampeTkY+NioiFg4GAf359fHt6enl5eXl5enp7fH1+f4CBg4SHiYuOkJOVmJqdoKKlp6qsrq+xsrS2t7i6u7u8vLy8vLy7u7q5uLa1s7GvrauqqKWjoJ6cmZeVko+NioiFg4B/fn18e3p6eXl5eXl5ent8fX5/gIGDhYeJi46QkpWXmpyfoaOmqKqsrq+xsrS1t7i5uru8vLy8vLy7u7q5uLa1s7GvrauopaOhn52amJWTkI6MiYeFg4F/fn18e3p6eXl5eXl6ent8fX5/gIGDhYeJjI6QkpWXmpyeoaOlp6mqrK6vsLKztba3ubq7u7y8vLy8u7u6ubm3trSysK6sq6mnpKKgnpuZl5STkI6LiYeFg4GAf359fHt6enl5eXl5enp7fH1+f4CBg4WHiYuNkJKUl5mcnqChoqSnqaurrq+xsrO1tre4ubq7u7y8vLy7u7u6ubi3tbSysK6sq6mnpKKfnZqYlZKQjouJhoSDgYB/fn18e3p6eXl5eXl6ent8fX5/gIGDhYeJi46QkpSXmZyeoaOlp6mqrK6vsLKztba3uLm6u7u8vLy8u7u6ubm3trSysK6sq6mnpKKgnpuZl5STkI6LiYeFg4GAf359fHt6enl5eXl5enp7fH1+f4CBg4WHiYuNj5KUlpmbnqChoqWnqaqsrq+xsrO1tre4ubq7u7y8vLy8u7u6ubm3trSysK6sq6mnpKKfnZqYlZKQjouJhoSDgYB+fn18e3p6eXl5eXl6e3x8fX5/gIGDhYeJi42QkpSXmZyeoKKkpqiprK6vsLKztba3uLm6u7u8vLy8u7u6ubm3trSysK6sq6mnpKKfnZuYlpOQjouJhoSDgYB/fn18e3p6eXl5eXl6e3x9fn+AgYOFh4mLjY+SlJaZm52foaOlp6mqrK6vsLKztba3uLm6u7u8vLy8u7u6ubm4trSysK6sq6mnpKKfnZuZlpOQjouJhoSDgYB/fn18e3p6eXl5eXl6e3x9fn+AgYOFh4mLjY+RlJaZm56goaOlp6mqrK6vsLKztba3uLm6u7u8vLy8u7u6ubm3trSysK6sq6mnpKKfnZuYlpOQjouJhoSDgYB/fn18e3p6eXl5eXl6e3x9fn+AgYOFh4mLjY+RlJaZm52goaOlp6irrK6vsLKztba3uLm6u7u8vLy8u7u6ubm4trSysK6sq6mnpKKgnZuZlpOQjouJhoSDgYB/fn18e3p6eQ==";
    audio.volume = 0.6;
    audioRef.current = audio;
  }, []);

  // Solicitar permissão de notificação no primeiro carregamento
  useEffect(() => {
    if (!userId) return;
    if (!("Notification" in window)) return;

    permissionRef.current = Notification.permission;

    if (Notification.permission === "default") {
      // Solicita permissão após pequeno delay para não ser intrusivo
      const timer = setTimeout(() => {
        Notification.requestPermission().then((perm) => {
          permissionRef.current = perm;
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [userId]);

  const playNotificationSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Browser pode bloquear autoplay — silencioso
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const showBrowserNotification = useCallback(
    (title: string, body: string, tag?: string) => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;

      const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");

      const options: NotificationOptions = {
        body,
        // No Android: passa imagem 100% transparente como icon (LargeIcon) para evitar que o Chrome/Android
        // gere o fallback de contato padrão (círculo cinza com a letra 'D').
        // Assim, a esquerda fica 100% limpa (invisível) e apenas a logo na direita (badge) aparece!
        icon: isAndroid ? "/transparent.png" : "/notification-icon.png",
        badge: "/notification-badge.png",
        tag: tag || `notif-${Date.now()}`,
        requireInteraction: false,
        data: {
          url: "/cliente",
        },
      };

      // No Android e navegadores modernos: prioriza o Service Worker para delegar diretamente ao WebAPK instalado
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, options);
          })
          .catch(() => {
            try {
              const notification = new Notification(title, options);
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            } catch {
              // ignore
            }
          });
      } else {
        try {
          const notification = new Notification(title, options);
          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        } catch {
          // ignore
        }
      }
    },
    []
  );

  // Mapear tipo de notificação para texto amigável
  const getNotificationTitle = useCallback((tipo: string, titulo: string) => {
    return titulo || "DUB Barbearia";
  }, []);

  // Escutar novas notificações em tempo real
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("push-notifications-manager")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as any;

          // Tocar som
          playNotificationSound();

          // Mostrar notificação do navegador
          showBrowserNotification(
            newNotif.titulo || "Nova notificação",
            newNotif.mensagem || "",
            `notif-${newNotif.id}`
          );

          // Toast in-app também
          const tipo = newNotif.tipo;
          if (tipo === "cancelamento" || tipo === "cancelamento_massa") {
            toast.error(newNotif.titulo, {
              description: newNotif.mensagem,
              duration: 6000,
            });
          } else if (tipo === "lembrete") {
            toast.info(newNotif.titulo, {
              description: newNotif.mensagem,
              duration: 8000,
            });
          } else {
            toast.success(newNotif.titulo, {
              description: newNotif.mensagem,
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, playNotificationSound, showBrowserNotification]);

  return {
    requestPermission: useCallback(() => {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          permissionRef.current = perm;
        });
      }
    }, []),
    permissionStatus: permissionRef.current,
  };
}
