import type { Line } from "@/domain/metro";
import type { Projector } from "@/lib/geometry/projection";
import { buildLinePath } from "@/lib/geometry/layout";

interface MetroLineProps {
  line: Line;
  project: Projector;
  dimmed?: boolean;
}

/** One metro line's track path. `vector-effect="non-scaling-stroke"` keeps its width constant
 * on screen regardless of the map's current zoom level. */
export function MetroLine({ line, project, dimmed = false }: MetroLineProps) {
  return (
    <path
      d={buildLinePath(line.stations, project)}
      stroke={line.colorHex}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={dimmed ? 0.25 : 1}
      vectorEffect="non-scaling-stroke"
      fill="none"
    />
  );
}
