type Kind = "LIVE" | "SIMULATION_RESULT" | "HISTORICAL";

const KIND_LABEL: Record<Kind, string> = {
  LIVE: "Live",
  SIMULATION_RESULT: "Simulation result",
  HISTORICAL: "Historical",
};

const KIND_CLASSES: Record<Kind, string> = {
  LIVE: "bg-emerald-900 text-emerald-300",
  SIMULATION_RESULT: "bg-blue-900 text-blue-300",
  HISTORICAL: "bg-violet-900 text-violet-300",
};

/** The dashboard's LIVE / SIMULATION RESULT / HISTORICAL distinction, read straight off each
 * section's own `kind` field rather than hardcoded per place this badge is used — see
 * `AnalyticsResponse`'s javadoc for what each of the three actually means. */
export function KindBadge({ kind }: { kind: Kind }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${KIND_CLASSES[kind]}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}
