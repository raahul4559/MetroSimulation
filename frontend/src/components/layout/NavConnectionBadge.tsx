"use client";

import { useOptionalSimulationData } from "@/providers/SimulationProvider";
import { StatusIndicator } from "@/components/ui/StatusIndicator";

/**
 * The data-source indicator in the navbar: what is on screen and how far to trust it.
 *
 * Derived from the frame's provenance (`describeFeed`), never from the socket alone — a connected
 * socket delivering a simulation reads "Simulation", and only a fresh observed feed reads "Live".
 * The title carries the server's reason for the active source.
 *
 * Rendered by the root layout, which sits above the provider, so it asks for the data optionally:
 * on / and /operations it shows the feed, and on /stations and /analytics it renders nothing —
 * those routes deliberately never open a connection.
 */
export function NavConnectionBadge() {
  const sim = useOptionalSimulationData();
  if (!sim) return null;
  const { feed } = sim;
  return (
    <span title={feed.detail} aria-label={`Data source: ${feed.label}. ${feed.detail}`}>
      <StatusIndicator label={feed.label} tone={feed.tone} pulse={feed.source === null && sim.connectionStatus === "connecting"} />
    </span>
  );
}
