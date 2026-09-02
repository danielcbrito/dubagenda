import { useEffect, useRef } from "react";

/**
 * Faz com que o gesto "voltar" (swipe iOS, botão Android, seta do header
 * do navegador) feche o overlay em vez de sair da tela.
 *
 * Padrão:
 *  1. pushState({ __overlay_key: <id único> }) ao abrir
 *  2. popstate → se o state anterior for nosso, chama onClose e para a propagação
 *  3. Fechar manualmente (X) → history.back() consome a entrada
 *  4. closedRef evita dupla execução (unmount + popstate simultâneos)
 *  5. Cleanup remove listener e limpa timers
 */
export function useBackDismissOverlay(open: boolean, onClose: () => void) {
  const closedRef = useRef(false);
  const keyRef = useRef<string>("");
  const pushedRef = useRef(false);

  // close() é chamado tanto pelo botão X quanto pelo popstate
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    closedRef.current = false;
    keyRef.current = `ovl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1) Empilha uma entrada de histórico exclusiva do overlay
    try {
      window.history.pushState(
        { __overlay_key: keyRef.current },
        "",
        window.location.href
      );
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }

    // 2) Intercepta o "voltar" do sistema
    const onPop = (e: PopStateEvent) => {
      if (closedRef.current) return;
      // Se a entrada nossa foi consumida (state atual != nosso), fecha
      const currentKey = (e.state as any)?.__overlay_key;
      if (currentKey !== keyRef.current) {
        closedRef.current = true;
        pushedRef.current = false; // história já consumiu nossa entrada
        e.stopImmediatePropagation();
        closeRef.current();
      }
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      // Se fechamos programaticamente (unmount por prop `open=false` ou destroy)
      // e a nossa entrada ainda está no topo, retiramos para não poluir o histórico.
      if (pushedRef.current && !closedRef.current) {
        closedRef.current = true;
        try {
          window.history.back();
        } catch {
          /* noop */
        }
      }
    };
  }, [open]);

  /** Handler para o botão X / cancelar / clique no backdrop. */
  const dismiss = () => {
    if (closedRef.current) return;
    if (pushedRef.current) {
      // Deixa o popstate disparar onClose — evita chamar duas vezes
      window.history.back();
    } else {
      closedRef.current = true;
      closeRef.current();
    }
  };

  return { dismiss };
}
