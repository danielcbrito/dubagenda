import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * High-performance bottom sheet with 3 snap points.
 * Uses CSS `transform: translateY()` for GPU-accelerated 60fps movement.
 *
 * Snap points are expressed as fractions of viewport height
 * representing how much of the sheet is VISIBLE:
 *   peek  = ~15%  (collapsed, just handle + title)
 *   mid   = ~45%  (default, half screen)
 *   full  = ~85%  (expanded, almost full screen)
 */

// ── Snap points (fraction of viewport the sheet occupies) ──
const SNAP_PEEK = 0.15;
const SNAP_MID = 0.45;
const SNAP_FULL = 0.85;
const SNAPS = [SNAP_PEEK, SNAP_MID, SNAP_FULL];

// Convert snap (visible fraction) to translateY px
function snapToTranslateY(snap: number, vh: number): number {
  return vh * (1 - snap);
}

// Convert translateY px to snap (visible fraction)
function translateYToSnap(ty: number, vh: number): number {
  return 1 - ty / vh;
}

interface BottomSheetProps {
  children: ReactNode;
  header: ReactNode;
  initialSnap?: number;
  onSnapChange?: (snap: number) => void;
}

export function BottomSheet({ children, header, initialSnap = SNAP_MID, onSnapChange }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);

  // Refs for gesture tracking (no re-renders during drag)
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startTranslateY = useRef(0);
  const currentTranslateY = useRef(0);
  const velocityY = useRef(0);
  const lastTouchY = useRef(0);
  const lastTouchTime = useRef(0);
  const listScrollLocked = useRef(false);
  const dragDecided = useRef(false);
  const isListDrag = useRef(false);

  const vh = useRef(window.innerHeight);

  // Keep vh fresh
  useEffect(() => {
    const update = () => { vh.current = window.innerHeight; };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Animate to snap ──
  const animateToSnap = useCallback((snap: number) => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const targetTY = snapToTranslateY(snap, vh.current);
    currentTranslateY.current = targetTY;

    sheet.style.transition = "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)";
    sheet.style.transform = `translateY(${targetTY}px)`;

    setCurrentSnap(snap);
    onSnapChange?.(snap);
  }, [onSnapChange]);

  // Set initial position
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const ty = snapToTranslateY(initialSnap, vh.current);
    currentTranslateY.current = ty;
    sheet.style.transform = `translateY(${ty}px)`;
  }, []);

  // ── Find best snap based on position + velocity ──
  const findTargetSnap = useCallback((currentVisibleFraction: number, velocity: number): number => {
    const FLING_THRESHOLD = 0.5; // px/ms

    // Fling detection: velocity > 0 means dragging DOWN (collapsing)
    if (Math.abs(velocity) > FLING_THRESHOLD) {
      const direction = velocity > 0 ? -1 : 1; // -1 = collapse, 1 = expand
      const candidates = SNAPS.filter(s =>
        direction > 0 ? s > currentVisibleFraction + 0.03 : s < currentVisibleFraction - 0.03
      );
      if (candidates.length > 0) {
        return direction > 0 ? Math.min(...candidates) : Math.max(...candidates);
      }
    }

    // Snap to nearest
    let closest = SNAPS[0];
    let minDist = Infinity;
    for (const s of SNAPS) {
      const d = Math.abs(s - currentVisibleFraction);
      if (d < minDist) { minDist = d; closest = s; }
    }
    return closest;
  }, []);

  // ── Handle area: always drags the sheet ──
  const onHandleTouchStart = useCallback((e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    sheet.style.transition = "none";
    isDragging.current = true;
    dragDecided.current = true;
    isListDrag.current = false;
    listScrollLocked.current = true;

    const touch = e.touches[0];
    startY.current = touch.clientY;
    startTranslateY.current = currentTranslateY.current;
    lastTouchY.current = touch.clientY;
    lastTouchTime.current = Date.now();
    velocityY.current = 0;
  }, []);

  const onHandleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - startY.current;
    const newTY = Math.max(
      snapToTranslateY(SNAP_FULL, vh.current),
      Math.min(snapToTranslateY(SNAP_PEEK, vh.current), startTranslateY.current + deltaY)
    );

    // Track velocity
    const now = Date.now();
    const dt = now - lastTouchTime.current;
    if (dt > 0) {
      velocityY.current = (touch.clientY - lastTouchY.current) / dt;
    }
    lastTouchY.current = touch.clientY;
    lastTouchTime.current = now;

    currentTranslateY.current = newTY;
    const sheet = sheetRef.current;
    if (sheet) sheet.style.transform = `translateY(${newTY}px)`;
  }, []);

  const onHandleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    listScrollLocked.current = false;

    const currentFraction = translateYToSnap(currentTranslateY.current, vh.current);
    const target = findTargetSnap(currentFraction, velocityY.current);
    animateToSnap(target);
  }, [findTargetSnap, animateToSnap]);

  // ── List area: scroll content OR drag sheet ──
  const onListTouchStart = useCallback((e: React.TouchEvent) => {
    const list = listRef.current;
    const sheet = sheetRef.current;
    if (!list || !sheet) return;

    sheet.style.transition = "none";
    dragDecided.current = false;
    isListDrag.current = false;
    listScrollLocked.current = false;

    const touch = e.touches[0];
    startY.current = touch.clientY;
    startTranslateY.current = currentTranslateY.current;
    lastTouchY.current = touch.clientY;
    lastTouchTime.current = Date.now();
    velocityY.current = 0;
  }, []);

  const onListTouchMove = useCallback((e: React.TouchEvent) => {
    const list = listRef.current;
    const sheet = sheetRef.current;
    if (!list || !sheet) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - startY.current;

    // Track velocity regardless
    const now = Date.now();
    const dt = now - lastTouchTime.current;
    if (dt > 0) {
      velocityY.current = (touch.clientY - lastTouchY.current) / dt;
    }
    lastTouchY.current = touch.clientY;
    lastTouchTime.current = now;

    // Decision point: are we dragging the sheet or scrolling the list?
    if (!dragDecided.current) {
      if (Math.abs(deltaY) < 8) return; // wait for enough movement
      dragDecided.current = true;

      const isAtTop = list.scrollTop <= 0;
      const pullingDown = deltaY > 0;
      const isNotFullyExpanded = currentSnap < SNAP_FULL - 0.02;

      // Drag sheet if:
      // 1. Pulling down AND list is at top (collapse gesture)
      // 2. Pulling up AND sheet not fully expanded yet
      if ((pullingDown && isAtTop) || (!pullingDown && isNotFullyExpanded)) {
        isListDrag.current = false; // dragging the sheet
        isDragging.current = true;
        listScrollLocked.current = true;
        list.style.overflowY = "hidden";
        list.style.touchAction = "none";
      } else {
        isListDrag.current = true; // scrolling the list
        return;
      }
    }

    if (isListDrag.current) return; // let browser handle scroll

    // Sheet dragging
    e.preventDefault();
    const newTY = Math.max(
      snapToTranslateY(SNAP_FULL, vh.current),
      Math.min(snapToTranslateY(SNAP_PEEK, vh.current), startTranslateY.current + deltaY)
    );

    currentTranslateY.current = newTY;
    sheet.style.transform = `translateY(${newTY}px)`;
  }, [currentSnap]);

  const onListTouchEnd = useCallback(() => {
    const list = listRef.current;
    if (list) {
      list.style.overflowY = "auto";
      list.style.touchAction = "";
    }

    if (!isDragging.current) {
      listScrollLocked.current = false;
      return;
    }

    isDragging.current = false;
    listScrollLocked.current = false;

    const currentFraction = translateYToSnap(currentTranslateY.current, vh.current);
    const target = findTargetSnap(currentFraction, velocityY.current);
    animateToSnap(target);
  }, [findTargetSnap, animateToSnap]);

  // ── Expose snap control for parent ──
  const expandToMid = useCallback(() => {
    if (currentSnap < SNAP_MID) animateToSnap(SNAP_MID);
  }, [currentSnap, animateToSnap]);

  return (
    <div
      ref={sheetRef}
      className="absolute left-0 right-0 z-[500] bg-background rounded-t-[22px] flex flex-col will-change-transform"
      style={{
        top: 0,
        height: "100%",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.18), 0 -2px 6px rgba(0,0,0,0.08)",
        borderTop: "1px solid hsl(var(--border) / 0.4)",
      }}
    >
      {/* ── Drag handle ── */}
      <div
        className="flex-shrink-0 flex items-center justify-center pt-3 pb-1.5 cursor-grab active:cursor-grabbing select-none"
        onTouchStart={onHandleTouchStart}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
        onMouseDown={(e) => {
          // Desktop support
          const sheet = sheetRef.current;
          if (!sheet) return;
          sheet.style.transition = "none";
          isDragging.current = true;
          startY.current = e.clientY;
          startTranslateY.current = currentTranslateY.current;
          lastTouchY.current = e.clientY;
          lastTouchTime.current = Date.now();
          velocityY.current = 0;

          const move = (ev: MouseEvent) => {
            if (!isDragging.current) return;
            const deltaY = ev.clientY - startY.current;
            const now = Date.now();
            const dt = now - lastTouchTime.current;
            if (dt > 0) velocityY.current = (ev.clientY - lastTouchY.current) / dt;
            lastTouchY.current = ev.clientY;
            lastTouchTime.current = now;
            const newTY = Math.max(
              snapToTranslateY(SNAP_FULL, vh.current),
              Math.min(snapToTranslateY(SNAP_PEEK, vh.current), startTranslateY.current + deltaY)
            );
            currentTranslateY.current = newTY;
            if (sheet) sheet.style.transform = `translateY(${newTY}px)`;
          };
          const up = () => {
            isDragging.current = false;
            const frac = translateYToSnap(currentTranslateY.current, vh.current);
            const target = findTargetSnap(frac, velocityY.current);
            animateToSnap(target);
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
          };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
      >
        <div className="w-9 h-[5px] rounded-full bg-muted-foreground/20" />
      </div>

      {/* ── Header (counter, etc) ── */}
      <div className="flex-shrink-0">
        {header}
      </div>

      {/* ── Scrollable list ── */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
        onTouchStart={onListTouchStart}
        onTouchMove={onListTouchMove}
        onTouchEnd={onListTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// Export snap constants for parent usage
export { SNAP_PEEK, SNAP_MID, SNAP_FULL };
