import { LogicalPosition } from "@tauri-apps/api/dpi";

/**
 * Return a proximity value from 0 to 1 on how close two rects are.
 *
 * - Return 0 when intersecting,
 * - Return 1 when distance more than `maxProximity`,
 * - Return between 0 and 1 when distance is less then `maxProximity`
 * but not intersecting.
 *
 * @param rect1 Position and size of rect.
 * @param rect2 Start and end position of rect.
 * @param maxProximity Distance from which to calculate value between 0 and 1.
 * Any distance more than this will return 1.
 * @returns Value between 0 and 1 - 0 meaning intersecting and 1 meaning further
 * than `maxProximity`
 */
export const getRectProximity = (
  rect1: {
    position: { x: number; y: number };
    size: { height: number; width: number };
  },
  rect2: {
    endPoint: LogicalPosition;
    startPoint: LogicalPosition;
  },
  maxProximity = 25
) => {
  const r1Left = rect1.position.x;
  const r1Top = rect1.position.y;
  const r1Right = r1Left + rect1.size.width;
  const r1Bottom = r1Top + rect1.size.height;

  const r2Left = rect2.startPoint.x;
  const r2Top = rect2.startPoint.y;
  const r2Right = rect2.endPoint.x;
  const r2Bottom = rect2.endPoint.y;

  // Minimum distance between rectangles
  const dx = Math.max(r2Left - r1Right, r1Left - r2Right, 0);
  const dy = Math.max(r2Top - r1Bottom, r1Top - r2Bottom, 0);

  const distance = Math.hypot(dx, dy);

  // When dock inside region
  if (
    r2Left >= r1Left &&
    r2Right <= r1Right &&
    r2Top >= r1Top &&
    r2Bottom <= r1Bottom
  ) {
    const toLeft = r2Left - r1Left;
    const toRight = r1Right - r2Right;
    const toTop = r2Top - r1Top;
    const toBottom = r1Bottom - r2Bottom;
    const minEdgeDist = Math.min(toLeft, toRight, toTop, toBottom);
    return Math.min(1, minEdgeDist / maxProximity);
  }

  return Math.min(1, distance / maxProximity);
};
