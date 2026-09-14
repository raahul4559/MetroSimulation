export interface ViewTransform {
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

export const MIN_SCALE = 0.6;
export const MAX_SCALE = 8;
export const IDENTITY_TRANSFORM: ViewTransform = { scale: 1, tx: 0, ty: 0 };

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** SVG `transform` attribute for a `ViewTransform` — translate then scale, applied to a `<g>`. */
export function transformString({ scale, tx, ty }: ViewTransform): string {
  return `translate(${tx} ${ty}) scale(${scale})`;
}

/**
 * Recomputes translate so that `viewBoxPoint` (a fixed point in the outer `<svg>`'s viewBox
 * space, e.g. the cursor) keeps pointing at the same "world" coordinate after `scale` changes
 * to `nextScale` — the standard zoom-to-pointer trick.
 */
export function zoomTowards(
  current: ViewTransform,
  viewBoxPoint: { x: number; y: number },
  factor: number
): ViewTransform {
  const nextScale = clampScale(current.scale * factor);
  const worldX = (viewBoxPoint.x - current.tx) / current.scale;
  const worldY = (viewBoxPoint.y - current.ty) / current.scale;
  return {
    scale: nextScale,
    tx: viewBoxPoint.x - nextScale * worldX,
    ty: viewBoxPoint.y - nextScale * worldY,
  };
}
