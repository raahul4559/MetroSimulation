import type { Line } from "@/domain/metro";
import type { Projector } from "@/lib/geometry/projection";
import { buildLinePath } from "@/lib/geometry/layout";

export function LinePath({ line, project }: { line: Line; project: Projector }) {
  return (
    <path
      d={buildLinePath(line.stations, project)}
      stroke={line.colorHex}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}
