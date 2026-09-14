import { useCallback, useEffect, useRef, useState } from "react";
import {
  IDENTITY_TRANSFORM,
  clampScale,
  zoomTowards,
  type ViewTransform,
} from "@/lib/geometry/viewport";

interface ViewBoxPoint {
  readonly x: number;
  readonly y: number;
}

const WHEEL_ZOOM_FACTOR = 1.15;
const BUTTON_ZOOM_FACTOR = 1.3;

function toViewBoxPoint(svg: SVGSVGElement, clientX: number, clientY: number): ViewBoxPoint {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

/**
 * Pan/zoom state for MetroMap, applied as a `<g transform>` inside a fixed-viewBox `<svg>`.
 * Wheel zoom and drag-to-pan are wired via a native (non-passive) listener so `preventDefault`
 * actually stops page scroll — React's synthetic `onWheel` is passive and can't do that.
 */
export function useMapViewport(viewport: { width: number; height: number }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(IDENTITY_TRANSFORM);
  const isPanningRef = useRef(false);
  const lastPointRef = useRef<ViewBoxPoint>({ x: 0, y: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toViewBoxPoint(svg, event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      setTransform((current) => zoomTowards(current, point, factor));
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const zoomByFactor = useCallback(
    (factor: number) => {
      const svg = svgRef.current;
      const center = svg
        ? toViewBoxPoint(svg, ...clientCenterOf(svg))
        : { x: viewport.width / 2, y: viewport.height / 2 };
      setTransform((current) => zoomTowards(current, center, factor));
    },
    [viewport.width, viewport.height]
  );

  const zoomIn = useCallback(() => zoomByFactor(BUTTON_ZOOM_FACTOR), [zoomByFactor]);
  const zoomOut = useCallback(() => zoomByFactor(1 / BUTTON_ZOOM_FACTOR), [zoomByFactor]);
  const fitNetwork = useCallback(() => setTransform(IDENTITY_TRANSFORM), []);

  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  /** Centers the viewport on a fixed world point at a given zoom (default: a close-in focus level).
   * Snaps instantly unless `animate` is set (used for the station-3D "zoom in, then transition"
   * sequence — a `requestAnimationFrame` tween since the transform is an SVG attribute, which CSS
   * `transition` can't animate). */
  const focusOn = useCallback(
    (
      point: ViewBoxPoint,
      scale = 3,
      options?: { animate?: boolean; durationMs?: number; onComplete?: () => void }
    ) => {
      const nextScale = clampScale(scale);
      const target: ViewTransform = {
        scale: nextScale,
        tx: viewport.width / 2 - nextScale * point.x,
        ty: viewport.height / 2 - nextScale * point.y,
      };

      if (!options?.animate) {
        setTransform(target);
        options?.onComplete?.();
        return;
      }

      const start = transformRef.current;
      const duration = options.durationMs ?? 600;
      const startTime = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setTransform({
          scale: start.scale + (target.scale - start.scale) * eased,
          tx: start.tx + (target.tx - start.tx) * eased,
          ty: start.ty + (target.ty - start.ty) * eased,
        });
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          options.onComplete?.();
        }
      };
      requestAnimationFrame(step);
    },
    [viewport.width, viewport.height]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    isPanningRef.current = true;
    lastPointRef.current = toViewBoxPoint(svg, event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanningRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const point = toViewBoxPoint(svg, event.clientX, event.clientY);
    const dx = point.x - lastPointRef.current.x;
    const dy = point.y - lastPointRef.current.y;
    lastPointRef.current = point;
    setTransform((current) => ({ ...current, tx: current.tx + dx, ty: current.ty + dy }));
  }, []);

  const endPan = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    isPanningRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return {
    svgRef,
    scale: clampScale(transform.scale),
    transform,
    zoomIn,
    zoomOut,
    fitNetwork,
    focusOn,
    panHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endPan,
      onPointerLeave: endPan,
    },
  };
}

function clientCenterOf(svg: SVGSVGElement): [number, number] {
  const rect = svg.getBoundingClientRect();
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}
