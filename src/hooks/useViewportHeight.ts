import { useEffect, useState } from "react";

/**
 * Tracks the real visible viewport height (visualViewport API) so mobile keyboards
 * shrink the container instead of pushing content off-screen. Fallback: 100dvh.
 */
export function useViewportHeight() {
  const [height, setHeight] = useState<string>("100dvh");
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setHeight(`${vv.height}px`);
      setKeyboardOpen(window.innerHeight - vv.height > 150);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return { height, keyboardOpen };
}
