import type { ConnectionStatus } from "@/lib/ws/simulation-socket";

const LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Live",
  disconnected: "Disconnected",
};

const DOT_CLASSES: Record<ConnectionStatus, string> = {
  connecting: "bg-amber-400 animate-pulse",
  connected: "bg-emerald-400",
  disconnected: "bg-red-500",
};

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[status]}`} aria-hidden />
      {LABEL[status]}
    </div>
  );
}
