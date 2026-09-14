import { useCallback, useMemo, useState } from "react";

/** Tracks which line codes are toggled off on the map. Empty set = every line visible. */
export function useLineVisibility() {
  const [hiddenLineCodes, setHiddenLineCodes] = useState<ReadonlySet<string>>(() => new Set());

  const toggleLine = useCallback((code: string) => {
    setHiddenLineCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const showAllLines = useCallback(() => setHiddenLineCodes(new Set()), []);

  return useMemo(
    () => ({ hiddenLineCodes, toggleLine, showAllLines }),
    [hiddenLineCodes, toggleLine, showAllLines]
  );
}
