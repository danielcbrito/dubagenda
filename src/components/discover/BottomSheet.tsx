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

/**
 * Bottom sheet com 3 etapas e gesto contínuo:
 * - bem baixo
 * - metade da tela
 * - quase tela cheia
 *
 * O drag usa requestAnimationFrame e transfere o gesto para o scroll
 * quando a sheet encosta no topo, evitando o "teleporte" ao subir.
 */
export function BottomSheet({ children, header, initialSnap = SNAP_MID, onSnapChange }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const viewportHeightRef = useRef(getViewportHeight());
  const currentSnapRef = useRef(initialSnap);
  const currentTranslateYRef = useRef(snapToTranslateY(initialSnap, viewportHeightRef.current));
  const pendingTranslateYRef = useRef(currentTranslateYRef.current);
  const animationFrameRef = useRef<number | null>(null);
  const gestureRef = useRef<GestureState>(INITIAL_GESTURE);

  const applyTranslateY = useCallback((translateY: number) => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const nextTranslateY = clampTranslateY(translateY, viewportHeightRef.current);
    currentTranslateYRef.current = nextTranslateY;
    pendingTranslateYRef.current = nextTranslateY;

    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      const nextFrameTranslateY = pendingTranslateYRef.current;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translate3d(0, ${nextFrameTranslateY}px, 0)`;
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

    const clearTransition = () => {
      if (sheetRef.current) {
        sheetRef.current.style.transition = "";
      }
    };

    sheet.addEventListener("transitionend", clearTransition, { once: true });
  }, [onSnapChange]);

  const syncToCurrentSnap = useCallback(() => {
    viewportHeightRef.current = getViewportHeight();
    const translateY = snapToTranslateY(currentSnapRef.current, viewportHeightRef.current);

    if (sheetRef.current) {
      sheetRef.current.style.transition = "none";
    }

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
    const handleViewportResize = () => syncToCurrentSnap();

    window.addEventListener("resize", handleViewportResize);
    window.visualViewport?.addEventListener("resize", handleViewportResize);

    return () => {
      window.removeEventListener("resize", handleViewportResize);
      window.visualViewport?.removeEventListener("resize", handleViewportResize);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [syncToCurrentSnap]);

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
    const gesture = gestureRef.current;
    if (!gesture.active) return;

    const now = performance.now();
    const deltaTime = now - gesture.lastTime;
    if (deltaTime > 0) {
      const instantVelocity = (clientY - gesture.lastY) / deltaTime;
      gesture.velocityY = gesture.velocityY * 0.35 + instantVelocity * 0.65;
    }

    gesture.lastY = clientY;
    gesture.lastTime = now;
  }, []);

  const shouldDragSheetFromContent = useCallback((deltaY: number) => {
    const list = listRef.current;
    const isAtTop = (list?.scrollTop ?? 0) <= 0.5;
    const isFullyExpanded = currentTranslateYRef.current <= snapToTranslateY(SNAP_FULL, viewportHeightRef.current) + 1;

    if (deltaY > 0) {
      return isAtTop;
    }

    if (deltaY < 0) {
      return !isFullyExpanded;
    }

    return false;
  }, []);

  const dragSheet = useCallback((clientY: number, allowScrollHandoff: boolean) => {
    const gesture = gestureRef.current;
    const list = listRef.current;
    if (!gesture.active) return;

    const minTranslateY = snapToTranslateY(SNAP_FULL, viewportHeightRef.current);
    const maxTranslateY = snapToTranslateY(SNAP_PEEK, viewportHeightRef.current);
    const deltaY = clientY - gesture.startY;
    const rawTranslateY = gesture.startTranslateY + deltaY;

    if (rawTranslateY < minTranslateY) {
      applyTranslateY(minTranslateY);

      if (allowScrollHandoff && list) {
        const overflow = minTranslateY - rawTranslateY;
        list.scrollTop = gesture.startScrollTop + overflow;
      }

      return;
    }

    if (rawTranslateY > maxTranslateY) {
      applyTranslateY(maxTranslateY);
      return;
    }

    applyTranslateY(rawTranslateY);
  }, [applyTranslateY]);

  const finishGesture = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture.active) return;

    const shouldSnap = gesture.mode !== "content";
    const velocityY = gesture.velocityY;
    gestureRef.current = { ...INITIAL_GESTURE };

    if (!shouldSnap) return;

    const targetSnap = resolveTargetSnap(
      currentTranslateYRef.current,
      velocityY,
      viewportHeightRef.current
    );

    animateToSnap(targetSnap);
  }, [animateToSnap]);

  const handleHandleTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    beginGesture(event.touches[0].clientY, "handle");
  }, [beginGesture]);

  const handleHandleTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (!gestureRef.current.active) return;
    const clientY = event.touches[0].clientY;
    updateVelocity(clientY);
    event.preventDefault();
    dragSheet(clientY, false);
  }, [dragSheet, updateVelocity]);

  const handleContentTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    beginGesture(event.touches[0].clientY, "content");
  }, [beginGesture]);

  const handleContentTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture.active) return;

    const clientY = event.touches[0].clientY;
    updateVelocity(clientY);

    if (gesture.mode === "undecided") {
      const deltaY = clientY - gesture.startY;
      if (Math.abs(deltaY) < DRAG_DECISION_PX) return;
      gesture.mode = shouldDragSheetFromContent(deltaY) ? "sheet" : "content";
    }

    if (gesture.mode === "content") return;

    event.preventDefault();
    dragSheet(clientY, true);
  }, [dragSheet, shouldDragSheetFromContent, updateVelocity]);

  const handleHandleMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    beginGesture(event.clientY, "handle");

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!gestureRef.current.active) return;
      updateVelocity(moveEvent.clientY);
      dragSheet(moveEvent.clientY, false);
    };

    const handleMouseUp = () => {
      finishGesture();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [beginGesture, dragSheet, finishGesture, updateVelocity]);

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

      <div className="flex-shrink-0">{header}</div>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
        }}
        onTouchStart={handleContentTouchStart}
        onTouchMove={handleContentTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
      >
        {children}
      </div>
    </div>
  );
}

export { SNAP_PEEK, SNAP_MID, SNAP_FULL };
