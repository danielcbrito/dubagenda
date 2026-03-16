import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  ANIMATION_DURATION_MS,
  ANIMATION_EASING,
  DRAG_DECISION_PX,
  SNAP_FULL,
  SNAP_MID,
  SNAP_PEEK,
  clampTranslateY,
  resolveTargetSnap,
  snapToTranslateY,
} from "./bottomSheetPhysics";

interface BottomSheetProps {
  children: ReactNode;
  header: ReactNode;
  initialSnap?: number;
  onSnapChange?: (snap: number) => void;
}

type DragSource = "handle" | "content";
type DragMode = "undecided" | "sheet" | "content";

interface GestureState {
  active: boolean;
  source: DragSource;
  mode: DragMode;
  startY: number;
  lastY: number;
  lastTime: number;
  startTranslateY: number;
  startScrollTop: number;
  velocityY: number;
}

const INITIAL_GESTURE: GestureState = {
  active: false,
  source: "handle",
  mode: "undecided",
  startY: 0,
  lastY: 0,
  lastTime: 0,
  startTranslateY: 0,
  startScrollTop: 0,
  velocityY: 0,
};

function getViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

export function BottomSheet({ children, header, initialSnap = SNAP_MID, onSnapChange }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportHeightRef = useRef(getViewportHeight());
  const currentSnapRef = useRef(initialSnap);
  const currentTranslateYRef = useRef(snapToTranslateY(initialSnap, viewportHeightRef.current));
  const pendingTranslateYRef = useRef(currentTranslateYRef.current);
  const animationFrameRef = useRef<number | null>(null);
  const gestureRef = useRef<GestureState>(INITIAL_GESTURE);

  // ── Transform helpers ──

  const applyTranslateY = useCallback((translateY: number) => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const nextTranslateY = clampTranslateY(translateY, viewportHeightRef.current);
    currentTranslateYRef.current = nextTranslateY;
    pendingTranslateYRef.current = nextTranslateY;

    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translate3d(0, ${pendingTranslateYRef.current}px, 0)`;
      }
      animationFrameRef.current = null;
    });
  }, []);

  const animateToSnap = useCallback((snap: number) => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const targetTranslateY = snapToTranslateY(snap, viewportHeightRef.current);
    currentSnapRef.current = snap;
    currentTranslateYRef.current = targetTranslateY;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    sheet.style.transition = `transform ${ANIMATION_DURATION_MS}ms ${ANIMATION_EASING}`;
    sheet.style.transform = `translate3d(0, ${targetTranslateY}px, 0)`;
    onSnapChange?.(snap);

    sheet.addEventListener("transitionend", () => {
      if (sheetRef.current) sheetRef.current.style.transition = "";
    }, { once: true });
  }, [onSnapChange]);

  // ── Viewport sync ──

  const syncToCurrentSnap = useCallback(() => {
    viewportHeightRef.current = getViewportHeight();
    const translateY = snapToTranslateY(currentSnapRef.current, viewportHeightRef.current);
    if (sheetRef.current) sheetRef.current.style.transition = "none";
    applyTranslateY(translateY);
  }, [applyTranslateY]);

  useLayoutEffect(() => {
    currentSnapRef.current = initialSnap;
    viewportHeightRef.current = getViewportHeight();
    const initialTranslateY = snapToTranslateY(initialSnap, viewportHeightRef.current);
    currentTranslateYRef.current = initialTranslateY;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translate3d(0, ${initialTranslateY}px, 0)`;
    }
  }, [initialSnap]);

  useEffect(() => {
    const handleResize = () => syncToCurrentSnap();
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [syncToCurrentSnap]);

  // ── Gesture core ──

  const beginGesture = useCallback((clientY: number, source: DragSource) => {
    const sheet = sheetRef.current;
    const list = listRef.current;
    if (!sheet || !list) return;

    sheet.style.transition = "none";
    gestureRef.current = {
      active: true,
      source,
      mode: source === "handle" ? "sheet" : "undecided",
      startY: clientY,
      lastY: clientY,
      lastTime: performance.now(),
      startTranslateY: currentTranslateYRef.current,
      startScrollTop: list.scrollTop,
      velocityY: 0,
    };
  }, []);

  const updateVelocity = useCallback((clientY: number) => {
    const g = gestureRef.current;
    if (!g.active) return;
    const now = performance.now();
    const dt = now - g.lastTime;
    if (dt > 0) {
      g.velocityY = g.velocityY * 0.35 + ((clientY - g.lastY) / dt) * 0.65;
    }
    g.lastY = clientY;
    g.lastTime = now;
  }, []);

  const isFullyExpanded = useCallback(() => {
    return currentTranslateYRef.current <= snapToTranslateY(SNAP_FULL, viewportHeightRef.current) + 1;
  }, []);

  const dragSheet = useCallback((clientY: number, allowScrollHandoff: boolean) => {
    const g = gestureRef.current;
    const list = listRef.current;
    if (!g.active) return;

    const minTY = snapToTranslateY(SNAP_FULL, viewportHeightRef.current);
    const maxTY = snapToTranslateY(SNAP_PEEK, viewportHeightRef.current);
    const rawTY = g.startTranslateY + (clientY - g.startY);

    if (rawTY < minTY) {
      applyTranslateY(minTY);
      if (allowScrollHandoff && list) {
        list.scrollTop = g.startScrollTop + (minTY - rawTY);
      }
      return;
    }

    if (rawTY > maxTY) {
      applyTranslateY(maxTY);
      return;
    }

    applyTranslateY(rawTY);
  }, [applyTranslateY]);

  const finishGesture = useCallback(() => {
    const g = gestureRef.current;
    if (!g.active) return;

    const shouldSnap = g.mode !== "content";
    const velocityY = g.velocityY;
    gestureRef.current = { ...INITIAL_GESTURE };

    // Re-enable list scrolling
    const list = listRef.current;
    if (list) list.style.overflow = "";

    if (!shouldSnap) return;

    animateToSnap(resolveTargetSnap(
      currentTranslateYRef.current,
      velocityY,
      viewportHeightRef.current,
    ));
  }, [animateToSnap]);

  // ── Handle (drag bar) touch — React events are fine here ──

  const handleHandleTouchStart = useCallback((e: ReactTouchEvent) => {
    beginGesture(e.touches[0].clientY, "handle");
  }, [beginGesture]);

  const handleHandleTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!gestureRef.current.active) return;
    const clientY = e.touches[0].clientY;
    updateVelocity(clientY);
    e.preventDefault();
    dragSheet(clientY, false);
  }, [dragSheet, updateVelocity]);

  const handleHandleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    beginGesture(e.clientY, "handle");

    const onMove = (me: MouseEvent) => {
      if (!gestureRef.current.active) return;
      updateVelocity(me.clientY);
      dragSheet(me.clientY, false);
    };
    const onUp = () => {
      finishGesture();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [beginGesture, dragSheet, finishGesture, updateVelocity]);

  // ── Content area touch — NATIVE listeners with { passive: false } ──

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const onTouchStart = (e: TouchEvent) => {
      beginGesture(e.touches[0].clientY, "content");
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;

      const clientY = e.touches[0].clientY;
      updateVelocity(clientY);

      // ── Decision phase ──
      if (g.mode === "undecided") {
        const deltaY = clientY - g.startY;
        if (Math.abs(deltaY) < DRAG_DECISION_PX) return;

        const scrollTop = list.scrollTop;
        const atTop = scrollTop <= 0.5;
        const expanded = isFullyExpanded();

        if (deltaY > 0 && atTop) {
          // Pulling down at top → drag sheet down
          g.mode = "sheet";
        } else if (deltaY < 0 && !expanded) {
          // Swiping up but sheet not fully open → drag sheet up
          g.mode = "sheet";
        } else {
          // Normal list scroll
          g.mode = "content";
          return; // Let browser handle scroll natively
        }

        // We're taking over — block native scroll
        list.style.overflow = "hidden";
      }

      // ── Content mode: check for handoff to sheet ──
      if (g.mode === "content") {
        const deltaY = clientY - g.startY;
        const atTop = (list.scrollTop) <= 0.5;

        if (deltaY > DRAG_DECISION_PX && atTop) {
          // User scrolled to top and is still pulling down → take over
          g.mode = "sheet";
          g.startTranslateY = currentTranslateYRef.current;
          g.startY = clientY;
          g.startScrollTop = 0;
          list.style.overflow = "hidden";
          list.scrollTop = 0;
        } else {
          return; // Let native scroll continue
        }
      }

      // ── Sheet mode ──
      e.preventDefault();
      dragSheet(clientY, true);
    };

    const onTouchEnd = () => {
      finishGesture();
    };

    // { passive: false } is CRITICAL — allows preventDefault to work
    list.addEventListener("touchstart", onTouchStart, { passive: true });
    list.addEventListener("touchmove", onTouchMove, { passive: false });
    list.addEventListener("touchend", onTouchEnd, { passive: true });
    list.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      list.removeEventListener("touchstart", onTouchStart);
      list.removeEventListener("touchmove", onTouchMove);
      list.removeEventListener("touchend", onTouchEnd);
      list.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [beginGesture, dragSheet, finishGesture, isFullyExpanded, updateVelocity]);

  // ── Render ──

  return (
    <div
      ref={sheetRef}
      className="absolute left-0 right-0 z-[500] flex h-full flex-col rounded-t-[22px] bg-background will-change-transform"
      style={{
        top: 0,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18), 0 -2px 6px rgba(0,0,0,0.08)",
        borderTop: "1px solid hsl(var(--border) / 0.4)",
        contain: "layout paint style",
        backfaceVisibility: "hidden",
      }}
    >
      {/* ── Drag handle ── */}
      <div
        className="flex flex-shrink-0 select-none items-center justify-center pt-3 pb-1.5 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
        onTouchStart={handleHandleTouchStart}
        onTouchMove={handleHandleTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
        onMouseDown={handleHandleMouseDown}
      >
        <div className="h-[5px] w-9 rounded-full bg-muted-foreground/20" />
      </div>

      {/* ── Header ── */}
      <div className="flex-shrink-0">{header}</div>

      {/* ── Scrollable content ── */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export { SNAP_PEEK, SNAP_MID, SNAP_FULL };
