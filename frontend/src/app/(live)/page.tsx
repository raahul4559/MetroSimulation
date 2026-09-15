import { NetworkStage } from "@/components/map/NetworkStage";
import { SimulationControlsDock } from "@/components/layout/SimulationControlsDock";

/**
 * The network view.
 *
 * The map is the page — full-bleed under the navbar, with everything else floating over it. It was
 * previously a panel in the left column of a two-column grid, sharing the page's scroll with eight
 * stacked sidebar panels, which meant the most important element on the screen could be scrolled
 * out of view. Those panels now live on /operations, where deeper information belongs.
 */
export default function NetworkPage() {
  return (
    <main className="relative min-h-0 flex-1">
      <NetworkStage />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4">
        <SimulationControlsDock />
      </div>
    </main>
  );
}
