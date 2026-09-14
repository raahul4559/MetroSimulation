import type { Line } from "@/domain/metro";

interface LineFilterProps {
  lines: readonly Line[];
  hiddenLineCodes: ReadonlySet<string>;
  onToggleLine: (code: string) => void;
}

/** Shared with the map's own line toggles (`MapControls`) via lifted state — checking a line here
 * hides it on the map too, and vice versa. */
export function LineFilter({ lines, hiddenLineCodes, onToggleLine }: LineFilterProps) {
  return (
    <ul className="space-y-1.5">
      {lines.map((line) => {
        const checked = !hiddenLineCodes.has(line.code);
        return (
          <li key={line.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleLine(line.code)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-current"
                style={{ accentColor: line.colorHex }}
              />
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: line.colorHex, opacity: checked ? 1 : 0.35 }}
                aria-hidden
              />
              <span className={checked ? "text-slate-200" : "text-slate-500 line-through"}>
                {line.name}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
