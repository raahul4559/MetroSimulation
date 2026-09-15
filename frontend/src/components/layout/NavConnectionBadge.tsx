"use client";

import { useOptionalSimulationData } from "@/providers/SimulationProvider";
import { ConnectionIndicator } from "@/components/ui/ConnectionIndicator";

/**
 * The live-feed indicator in the navbar.
 *
 * Rendered by the root layout, which sits above the provider, so it asks for the data optionally:
 * on / and /operations it shows the socket's state, and on /stations and /analytics it renders
 * nothing — those routes deliberately never open a connection.
 */
export function NavConnectionBadge() {
  const sim = useOptionalSimulationData();
  if (!sim) return null;
  return <ConnectionIndicator status={sim.connectionStatus} />;
}
