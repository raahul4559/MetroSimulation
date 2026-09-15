/**
 * Operator display preferences for the network map.
 *
 * A module-level store rather than context, deliberately: the settings menu lives in the root
 * navbar (above the simulation provider) while the map lives inside it, so the two have no common
 * React ancestor to share state through. This mirrors `lib/audio/AudioManager`, which solves the
 * same problem the same way and is already the established pattern here.
 *
 * Persisted, because a preference the operator has to re-set on every reload is not a preference.
 */

export interface MapPreferences {
  /** Station name labels. Zoom-dependent regardless — this is the master switch. */
  readonly labelsVisible: boolean;
  /** Block signal markers. Off by default: they are a debugging aid, not an operations display. */
  readonly signalsVisible: boolean;
  /** Passenger-density halos behind station markers. */
  readonly densityVisible: boolean;
}

export const DEFAULT_MAP_PREFERENCES: MapPreferences = {
  labelsVisible: true,
  signalsVisible: false,
  densityVisible: true,
};

const STORAGE_KEY = "namma-metro.map-preferences";

class MapPreferencesStore {
  private preferences: MapPreferences = DEFAULT_MAP_PREFERENCES;
  private readonly listeners = new Set<(preferences: MapPreferences) => void>();
  private hydrated = false;

  get(): MapPreferences {
    // Hydrate lazily so the first server render and the first client render agree on the defaults;
    // reading localStorage during module init would make them diverge and trip hydration.
    if (!this.hydrated && typeof window !== "undefined") {
      this.hydrated = true;
      this.preferences = load();
    }
    return this.preferences;
  }

  subscribe(listener: (preferences: MapPreferences) => void): () => void {
    this.listeners.add(listener);
    // Deliver the hydrated value immediately — a subscriber mounting after hydration would
    // otherwise sit on the defaults until the next change.
    listener(this.get());
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(patch: Partial<MapPreferences>): void {
    this.preferences = { ...this.get(), ...patch };
    save(this.preferences);
    for (const listener of this.listeners) listener(this.preferences);
  }
}

export const mapPreferences = new MapPreferencesStore();

function load(): MapPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MAP_PREFERENCES;
    return { ...DEFAULT_MAP_PREFERENCES, ...(JSON.parse(raw) as Partial<MapPreferences>) };
  } catch {
    return DEFAULT_MAP_PREFERENCES;
  }
}

function save(preferences: MapPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // A full or unavailable localStorage is not worth failing a render over.
  }
}
