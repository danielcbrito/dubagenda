const SNAP_PEEK = 0.12;
const SNAP_MID = 0.5;
const SNAP_FULL = 0.9;
const SNAPS = [SNAP_PEEK, SNAP_MID, SNAP_FULL] as const;

const FLING_PROJECTION_MS = 180;
const ANIMATION_DURATION_MS = 280;
const ANIMATION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const DRAG_DECISION_PX = 6;

function snapToTranslateY(snap: number, viewportHeight: number): number {
  return viewportHeight * (1 - snap);
}

function translateYToSnap(translateY: number, viewportHeight: number): number {
  return 1 - translateY / viewportHeight;
}

function clampTranslateY(translateY: number, viewportHeight: number): number {
  return Math.max(
    snapToTranslateY(SNAP_FULL, viewportHeight),
    Math.min(snapToTranslateY(SNAP_PEEK, viewportHeight), translateY)
  );
}

function resolveTargetSnap(currentTranslateY: number, velocityY: number, viewportHeight: number): number {
  const projectedTranslateY = clampTranslateY(
    currentTranslateY + velocityY * FLING_PROJECTION_MS,
    viewportHeight
  );

  let closestSnap = SNAPS[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const snap of SNAPS) {
    const distance = Math.abs(snapToTranslateY(snap, viewportHeight) - projectedTranslateY);
    if (distance < minDistance) {
      minDistance = distance;
      closestSnap = snap;
    }
  }

  return closestSnap;
}

export {
  ANIMATION_DURATION_MS,
  ANIMATION_EASING,
  DRAG_DECISION_PX,
  SNAP_FULL,
  SNAP_MID,
  SNAP_PEEK,
  SNAPS,
  clampTranslateY,
  resolveTargetSnap,
  snapToTranslateY,
  translateYToSnap,
};
