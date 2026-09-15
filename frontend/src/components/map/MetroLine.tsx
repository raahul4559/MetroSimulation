import type { Line } from "@/domain/metro";
import type { Projector } from "@/lib/geometry/projection";
import { buildLinePath } from "@/lib/geometry/layout";
import { lineVividColor } from "@/lib/ui/lineColor";
import { SURFACE_HEX } from "@/lib/ui/tone";

interface MetroLineProps {
  line: Line;
  project: Projector;
  /** Recedes this line when the operator's attention is on something else. */
  dimmed?: boolean;
}

/**
 * One metro line's track path.
 *
 * Drawn as a casing plus a stroke: the casing is the canvas colour, so where two lines cross, the
 * upper one reads as passing over rather than merging into a colour soup. The stroke uses the
 * lifted `-vivid` tier because the true brand purple is nearly invisible against a near-black map.
 *
 * `vector-effect="non-scaling-stroke"` keeps both widths constant on screen regardless of zoom.
 */
export function MetroLine({ line, project, dimmed = false }: MetroLineProps) {
  const d = buildLinePath(line.stations, project);

  return (
    <g
      className="transition-opacity duration-(--duration-base) ease-(--ease-out)"
      opacity={dimmed ? 0.22 : 1}
    >
      <path
        d={d}
        stroke={SURFACE_HEX.canvas}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        fill="none"
      />
      <path
        d={d}
        stroke={lineVividColor(line)}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        fill="none"
      />
    </g>
  );
}
