import type { Line } from "@/domain/metro";

export function MapLegend({ lines }: { lines: readonly Line[] }) {
  return (
    <ul className="flex flex-wrap gap-4">
      {lines.map((line) => (
        <li key={line.id} className="flex items-center gap-2 text-xs text-slate-300">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: line.colorHex }}
            aria-hidden
          />
          {line.name}
        </li>
      ))}
    </ul>
  );
}
