"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IDENTITY_TRANSFORM,
  centerOn,
  clampScale,
  easeOutCubic,
  lerpTransform,
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

interface MapViewportOptions {
  /**
   * The framing this instance starts at. A lazy initial value only — it seeds the first mount and
   * never fights the operator afterwards. This is how the map comes back from the 3D view already
   * pushed in on the station it left, rather than snapping to fit-network.
   */
  readonly initialTransform?: ViewTransform;
}

/**
 * Pan/zoom state for MetroMap, applied as a `<g transform>` inside a fixed-viewBox `<svg>`.
 * Wheel zoom and drag-to-pan are wired via a native (non-passive) listener so `preventDefault`
 * actually stops page scroll — React's synthetic `onWheel` is passive and can't do that.
 */
export function useMapViewport(
  viewport: { width: number; height: number },
  options?: MapViewportOptions
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [transform, setTransform] = useState<ViewTransform>(
    () => options?.initialTransform ?? IDENTITY_TRANSFORM
  );
  const isPanningRef = useRef(false);
  const lastPointRef = useRef<ViewBoxPoint>({ x: 0, y: 0 });
  /**
   * Generation counter for camera tweens.
   *
   * Each tween captures the generation it started at and drops its own frames once superseded.
   * Without this, a second `focusOn`/`animateTo` issued while one is in flight leaves *both*
   * rAF loops calling setTransform every frame — they fight, and both fire their `onComplete`.
   * That was unreachable while the only animated caller unmounted the component on completion;
   * it stops being unreachable the moment a transition owner can issue a move while the
   * train-focus effect is also running.
   */
  const tweenIdRef = useRef(0);

  // Cancel any in-flight tween on unmount, so a completed animation cannot advance a state
  // machine that belongs to a component which no longer exists.
  useEffect(() => () => {
    tweenIdRef.current += 1;
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      // Wheeling is the operator taking the camera back from any tween in flight.
      tweenIdRef.current += 1;
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

  // A manual zoom or pan supersedes any camera move in flight — the operator wins.
  const cancelTween = useCallback(() => {
    tweenIdRef.current += 1;
  }, []);

  const zoomIn = useCallback(() => {
    cancelTween();
    zoomByFactor(BUTTON_ZOOM_FACTOR);
  }, [cancelTween, zoomByFactor]);
  const zoomOut = useCallback(() => {
    cancelTween();
    zoomByFactor(1 / BUTTON_ZOOM_FACTOR);
  }, [cancelTween, zoomByFactor]);
  const fitNetwork = useCallback(() => {
    cancelTween();
    setTransform(IDENTITY_TRANSFORM);
  }, [cancelTween]);

  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  /**
   * Eases the viewport to an exact target transform.
   *
   * A `requestAnimationFrame` tween rather than a CSS transition because the value being animated
   * is an SVG `transform` attribute, which CSS cannot interpolate. Pass `durationMs: 0` to land
   * immediately — which is what the reduced-motion path does.
   */
  const animateTo = useCallback(
    (target: ViewTransform, options?: { durationMs?: number; onComplete?: () => void }) => {
      const duration = options?.durationMs ?? 600;
      const id = (tweenIdRef.current += 1);

      if (duration <= 0) {
        setTransform(target);
        options?.onComplete?.();
        return;
      }

      const start = transformRef.current;
      const startTime = performance.now();

      const step = (now: number) => {
        // Superseded by a newer move, a manual pan/zoom, or unmount — drop the frame and, with it,
        // this tween's onComplete.
        if (tweenIdRef.current !== id) return;

        const t = Math.min(1, (now - startTime) / duration);
        setTransform(lerpTransform(start, target, easeOutCubic(t)));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          options?.onComplete?.();
        }
      };
      requestAnimationFrame(step);
    },
    []
  );

  /** Centers the viewport on a fixed world point at a given zoom (default: a close-in focus level).
   * Snaps instantly unless `animate` is set. */
  const focusOn = useCallback(
    (
      point: ViewBoxPoint,
      scale = 3,
      options?: { animate?: boolean; durationMs?: number; onComplete?: () => void }
    ) => {
      const target = centerOn(point, scale, viewport);

      if (!options?.animate) {
        tweenIdRef.current += 1;
        setTransform(target);
        options?.onComplete?.();
        return;
      }

      animateTo(target, {
        durationMs: options.durationMs ?? 600,
        ...(options.onComplete ? { onComplete: options.onComplete } : {}),
      });
    },
    [viewport, animateTo]
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    // Dragging takes the camera back from any tween in flight.
    tweenIdRef.current += 1;
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
    animateTo,
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
