import { useEffect, useState } from "react";

/**
 * Tracks the real visible viewport height and offset (visualViewport API)
 * so mobile keyboards shrink the container smoothly without pushing content
 * off-screen or causing overlap on both iOS Safari and Android Chrome.
 */
export function useViewportHeight() {
  const [viewport, setViewport] = useState<{
    height: string;
    offsetTop: number;
    keyboardOpen: boolean;
  }>(() => {
    if (typeof window === "undefined") {
      return { height: "100dvh", offsetTop: 0, keyboardOpen: false };
    }
    const vv = window.visualViewport;
    return {
      height: vv ? `${vv.height}px` : "100dvh",
      offsetTop: vv?.offsetTop ?? 0,
      keyboardOpen: false,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;

    const update = () => {
      if (vv) {
        // Detect keyboard opening: significant shrink in height compared to window.innerHeight
        const isKb = (window.innerHeight - vv.height) > 120;
        setViewport({
          height: `${vv.height}px`,
          offsetTop: vv.offsetTop || 0,
          keyboardOpen: isKb,
        });
      } else {
        setViewport({
          height: "100dvh",
          offsetTop: 0,
          keyboardOpen: false,
        });
      }
    };

    update();
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);

  return viewport;
}

