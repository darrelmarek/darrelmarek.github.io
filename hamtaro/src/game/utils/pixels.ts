/** Snap to whole pixels for crisp pixel-art rendering. */
export function snap(value: number): number {
  return Math.round(value);
}

export function snapPoint(x: number, y: number): { x: number; y: number } {
  return { x: snap(x), y: snap(y) };
}
