import type { Line } from "@/domain/metro";

export function LineList({ lines }: { lines: readonly Line[] }) {
  return (
    <ul className="space-y-3">
      {lines.map((line) => (
        <li key={line.id}>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: line.colorHex }}
              aria-hidden
            />
            <span className="text-sm font-medium text-slate-100">{line.name}</span>
            <span className="text-xs text-slate-500">{line.stations.length} stations</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
