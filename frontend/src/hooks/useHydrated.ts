import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during the server render and the hydration pass, true afterwards. For values that can't
 * match between server and client — a seconds-precision clock is stale by the time it hydrates.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
