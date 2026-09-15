import type { ReactNode } from "react";
import { SimulationProvider } from "@/providers/SimulationProvider";

/**
 * Everything that needs the live simulation feed.
 *
 * The `(live)` group is URL-invisible, so `/` and `/operations` keep their paths while sharing one
 * layout instance. Next preserves that instance across client-side navigation within the group,
 * which means switching between the map and the operations dashboard does not tear down and
 * re-establish the STOMP connection — the clock keeps running and no state is re-seeded. Routes
 * outside the group never mount the provider, so they never open a socket.
 *
 * This must stay a server component that passes `children` through as a prop. Because the element
 * is created here and handed to `SimulationProvider`, it is referentially stable across the
 * provider's re-renders — and the provider re-renders on every WebSocket frame. Rewriting this to
 * call the hooks inline and render the tree directly would re-render the entire page sixty times a
 * minute instead of only the components that subscribe.
 */
export default function LiveLayout({ children }: { children: ReactNode }) {
  return <SimulationProvider>{children}</SimulationProvider>;
}
