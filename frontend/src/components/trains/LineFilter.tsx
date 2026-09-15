import type { Line } from "@/domain/metro";
import { cn } from "@/lib/ui/cn";
import { lineVividColor } from "@/lib/ui/lineColor";

interface LineFilterProps {
  lines: readonly Line[];
  hiddenLineCodes: ReadonlySet<string>;
  onToggleLine: (code: string) => void;
}

/** Shared with the map's own line toggles (`MapLegend`) via lifted state — unchecking a line here
 * hides it on the map too, and vice versa. */
export function LineFilter({ lines, hiddenLineCodes, onToggleLine }: LineFilterProps) {
  return (
    <ul className="space-y-0.5">
      {lines.map((line) => {
        const checked = !hiddenLineCodes.has(line.code);
        return (
          <li key={line.id}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm",
                "transition-colors duration-(--duration-fast) hover:bg-white/5",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleLine(line.code)}
                className="size-3.5 shrink-0 rounded"
                style={{ accentColor: line.colorHex }}
              />
              <span
                className="size-2.5 shrink-0 rounded-full transition-opacity"
                style={{ backgroundColor: line.colorHex, opacity: checked ? 1 : 0.3 }}
                aria-hidden
              />
              <span
                className={cn("truncate text-xs", !checked && "text-muted line-through")}
                style={checked ? { color: lineVividColor(line) } : undefined}
              >
                {line.name}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
