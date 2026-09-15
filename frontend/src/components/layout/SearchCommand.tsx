"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, TrainFront } from "lucide-react";
import type { Station } from "@/domain/metro";
import type { TrainState } from "@/domain/trainsim";
import {
  useOptionalNetworkData,
  useOptionalSimulationData,
  useOptionalTrainSelection,
} from "@/providers/SimulationProvider";
import { LineBadge } from "@/components/ui/LineBadge";
import { cn } from "@/lib/ui/cn";

const MAX_RESULTS = 8;

type Result =
  | { readonly kind: "station"; readonly station: Station }
  | { readonly kind: "train"; readonly train: TrainState };

/**
 * Find a station or a train and go to it.
 *
 * Opens on ⌘K / Ctrl-K or "/", which is what anyone who uses an operations tool expects. Searches
 * only what is already in memory — the network topology and the live roster — so it needs no
 * endpoint of its own and stays correct as trains move.
 *
 * Renders nothing outside the live route group, where there is no network data to search.
 */
export function SearchCommand() {
  const network = useOptionalNetworkData();
  const sim = useOptionalSimulationData();
  const selection = useOptionalTrainSelection();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typingElsewhere =
        target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.isContentEditable;

      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typingElsewhere)) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Clearing on close happens in the handler rather than an effect: it is a consequence of the
  // operator's action, not state that needs synchronising with anything external.
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const results = useMemo<readonly Result[]>(() => {
    if (!network || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const stations: Result[] = network.stations
      .filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .map((station) => ({ kind: "station", station }));
    const trains: Result[] = (sim?.trains ?? [])
      .filter((t) => t.code.toLowerCase().includes(q))
      .map((train) => ({ kind: "train", train }));
    return [...stations, ...trains].slice(0, MAX_RESULTS);
  }, [network, sim, query]);

  if (!network || !selection) return null;

  function choose(result: Result) {
    if (!selection) return;
    if (result.kind === "station") selection.selectStation(result.station.id);
    else selection.selectTrain(result.train.id);
    // Selecting only matters on the map, so make sure that is what the operator is looking at.
    router.push("/");
    close();
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (event.key === "Enter") {
      const result = results[activeIndex];
      if (result) {
        event.preventDefault();
        choose(result);
      }
    }
  }

  const lineByCode = new Map(network.lines.map((l) => [l.code, l]));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-md px-2.5 text-xs text-muted",
          "h-8 ring-1 ring-inset ring-edge transition-colors hover:text-secondary hover:ring-edge-strong",
          "sm:w-52 sm:justify-between",
        )}
      >
        <span className="flex items-center gap-2">
          <Search size={14} aria-hidden />
          <span className="hidden sm:inline">Search stations, trains</span>
          <span className="sr-only sm:hidden">Search stations and trains</span>
        </span>
        <kbd className="hidden rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[var(--z-toast)] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-[2px]"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search stations and trains"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-edge motion-safe:animate-[panel-in_var(--duration-base)_var(--ease-out)]"
          >
            <div className="flex items-center gap-2.5 border-b border-divider px-3.5">
              <Search size={16} className="shrink-0 text-muted" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="Search stations and trains…"
                aria-label="Search stations and trains"
                className="h-12 w-full bg-transparent text-sm text-content outline-none placeholder:text-muted"
              />
            </div>

            {query.trim() && (
              <ul className="scroll-thin max-h-72 overflow-y-auto p-1.5" role="listbox">
                {results.length === 0 && (
                  <li className="px-2.5 py-3 text-xs text-muted">No stations or trains match.</li>
                )}
                {results.map((result, index) => {
                  const active = index === activeIndex;
                  const key =
                    result.kind === "station" ? `s-${result.station.id}` : `t-${result.train.id}`;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onPointerEnter={() => setActiveIndex(index)}
                        onClick={() => choose(result)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
                          active ? "bg-white/8 text-content" : "text-secondary",
                        )}
                      >
                        {result.kind === "station" ? (
                          <>
                            <Search size={14} className="shrink-0 text-muted" aria-hidden />
                            <span className="truncate">{result.station.name}</span>
                            <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">
                              {result.station.code}
                            </span>
                          </>
                        ) : (
                          <>
                            <TrainFront size={14} className="shrink-0 text-muted" aria-hidden />
                            <span className="tabular truncate font-mono">{result.train.code}</span>
                            <LineBadge
                              line={lineByCode.get(result.train.lineCode) ?? null}
                              className="ml-auto shrink-0"
                            />
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
