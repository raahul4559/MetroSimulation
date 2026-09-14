import { useEffect, useState } from "react";
import type { Interchange, Line, Station, Track } from "@/domain/metro";
import { metroApi } from "@/lib/api/metro";
import { ApiError } from "@/lib/api/client";

interface NetworkState {
  lines: Line[];
  stations: Station[];
  tracks: Track[];
  interchanges: Interchange[];
  isLoading: boolean;
  error: string | null;
}

const EMPTY_STATE: Omit<NetworkState, "isLoading" | "error"> = {
  lines: [],
  stations: [],
  tracks: [],
  interchanges: [],
};

export function useNetwork(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    ...EMPTY_STATE,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const network = await metroApi.getNetwork();
        if (!cancelled) {
          setState({
            lines: [...network.lines],
            stations: [...network.stations],
            tracks: [...network.tracks],
            interchanges: [...network.interchanges],
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : "Failed to load network data.";
          setState({ ...EMPTY_STATE, isLoading: false, error: message });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
