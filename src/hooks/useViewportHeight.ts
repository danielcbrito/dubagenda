import { useEffect, useRef, useState } from "react";

/**
 * Tracks the real visible viewport height (visualViewport API)
 * so mobile keyboards shrink the container smoothly without pushing content
 * off-screen or causing overlap on both iOS Safari and Android Chrome.
 *
 * Strategy:
 * - `height` is always `visualViewport.height` — this already accounts for
 *   the keyboard AND the Chrome Android autofill suggestion bar, so the
 *   fixed shell never overflows below the keyboard.
 * - `keyboardOpen` is detected by comparing the current height against a
 *   stable reference captured at mount time (before any keyboard appears).
 * - A requestAnimationFrame coalesces rapid resize/scroll events so the
 *   button doesn't flicker during keyboard animations.
 */
export function useViewportHeight() {
  // Capture the initial full height once at mount — before any keyboard
  // opens — so we have a stable baseline for keyboard detection.
  const fullHeightRef = useRef<number>(
    typeof window !== "undefined"
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 0
  );

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
    let rafId: number | null = null;

    const update = () => {
      if (rafId !== null) return; // coalesce
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (vv) {
          // Update the full-height reference only when the viewport grows
          // (keyboard closed). Never shrink the reference.
          if (vv.height > fullHeightRef.current) {
            fullHeightRef.current = vv.height;
          }
          // Keyboard (+ autofill bar) is open when current height is
          // significantly smaller than the captured full height.
          const isKb = (fullHeightRef.current - vv.height) > 100;
          setViewport((prev) => {
            const nextHeight = `${vv.height}px`;
            const nextOffset = vv.offsetTop || 0;
            if (
              prev.height === nextHeight &&
              prev.offsetTop === nextOffset &&
              prev.keyboardOpen === isKb
            ) {
              return prev; // no change — skip re-render
            }
            return { height: nextHeight, offsetTop: nextOffset, keyboardOpen: isKb };
          });
        } else {
          setViewport({ height: "100dvh", offsetTop: 0, keyboardOpen: false });
        }
      });
    };

    update();
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);

  return viewport;
}
