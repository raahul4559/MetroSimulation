import type { ConnectionStatus } from "@/lib/ws/train-simulation-socket";
import { StatusIndicator } from "./StatusIndicator";
import type { Tone } from "@/lib/ui/tone";

const LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Disconnected",
};

const TONE: Record<ConnectionStatus, Tone> = {
  connecting: "warning",
  connected: "positive",
  disconnected: "danger",
};

/** The simulation feed's state, in the navbar. A thin wrapper over StatusIndicator so the
 * connection dot cannot drift away from every other status dot in the app. */
export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <StatusIndicator label={LABEL[status]} tone={TONE[status]} pulse={status === "connecting"} />
  );
}
