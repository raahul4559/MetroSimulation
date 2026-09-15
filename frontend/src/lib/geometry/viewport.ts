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

/**
 * The transform that puts `point` dead-centre in the viewBox at `scale`.
 *
 * Extracted from `useMapViewport.focusOn` so a caller driving a transition can compute the exact
 * framing the map will settle on without owning the map's viewport state — which is what lets the
 * 2D→3D hand-off capture a return framing and restore it later.
 */
export function centerOn(
  point: { x: number; y: number },
  scale: number,
  viewport: { width: number; height: number }
): ViewTransform {
  const nextScale = clampScale(scale);
  return {
    scale: nextScale,
    tx: viewport.width / 2 - nextScale * point.x,
    ty: viewport.height / 2 - nextScale * point.y,
  };
}

/** Componentwise interpolation between two transforms. `easedT` is already eased, 0..1. */
export function lerpTransform(from: ViewTransform, to: ViewTransform, easedT: number): ViewTransform {
  return {
    scale: from.scale + (to.scale - from.scale) * easedT,
    tx: from.tx + (to.tx - from.tx) * easedT,
    ty: from.ty + (to.ty - from.ty) * easedT,
  };
}

/** Cubic ease-out, the map camera's motion curve. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
