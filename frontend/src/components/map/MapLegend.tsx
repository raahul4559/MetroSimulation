"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Line } from "@/domain/metro";
import { cn } from "@/lib/ui/cn";
import { lineVividColor } from "@/lib/ui/lineColor";
import { Surface } from "@/components/ui/Surface";

interface MapLegendProps {
  lines: readonly Line[];
  hiddenLineCodes: ReadonlySet<string>;
  onToggleLine: (code: string) => void;
}

/**
 * The line key, which doubles as the visibility filter.
 *
 * A legend and a filter were previously two separate controls — a toolbar of toggle chips over the
 * map, and a checkbox list in the sidebar — both writing the same lifted state. They are the same
 * affordance: this is where you learn what a colour means and where you turn it off.
 *
 * Collapsible because on a small screen three lines of key is a meaningful fraction of the map.
 */
export function MapLegend({ lines, hiddenLineCodes, onToggleLine }: MapLegendProps) {
  const [open, setOpen] = useState(true);

  return (
    <Surface variant="overlay" padding="none" className="pointer-events-auto w-[180px] p-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted transition-colors hover:text-secondary"
      >
        Lines
        <ChevronDown
          size={13}
          aria-hidden
          className={cn("transition-transform duration-(--duration-fast)", !open && "-rotate-90")}
        />
      </button>

      {open && (
        <ul className="pb-0.5">
          {lines.map((line) => {
            const visible = !hiddenLineCodes.has(line.code);
            return (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => onToggleLine(line.code)}
                  aria-pressed={visible}
                  title={visible ? `Hide ${line.name}` : `Show ${line.name}`}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-white/5"
                >
                  <span
                    aria-hidden
                    className="h-1 w-4 shrink-0 rounded-full transition-opacity"
                    style={{ backgroundColor: line.colorHex, opacity: visible ? 1 : 0.25 }}
                  />
                  <span
                    className={cn("truncate", !visible && "text-muted line-through")}
                    style={visible ? { color: lineVividColor(line) } : undefined}
                  >
                    {line.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}
