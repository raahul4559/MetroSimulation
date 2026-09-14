import type { ReactNode } from "react";
import { KindBadge } from "@/components/analytics/KindBadge";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  kind: "LIVE" | "SIMULATION_RESULT" | "HISTORICAL";
  children: ReactNode;
  /** The table-view toggle — the accessibility twin of every chart. */
  tableHeaders?: string[];
  tableRows?: (string | number)[][];
}

export function ChartCard({ title, subtitle, kind, children, tableHeaders, tableRows }: ChartCardProps) {
  return (
    <figure className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <KindBadge kind={kind} />
      </div>
      {children}
      {tableHeaders && tableRows && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">View as table</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500">
                  {tableHeaders.map((h) => (
                    <th key={h} className="border-b border-slate-800 py-1 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="[font-variant-numeric:tabular-nums]">
                {tableRows.map((row, i) => (
                  <tr key={i} className="text-slate-300">
                    {row.map((cell, j) => (
                      <td key={j} className="border-b border-slate-800/60 py-1 pr-4">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
