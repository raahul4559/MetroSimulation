import type { ReactNode } from "react";
import type { AnalyticsKind } from "@/domain/trainsim/analytics";
import { KindBadge } from "@/components/analytics/KindBadge";
import { Surface } from "@/components/ui/Surface";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  kind: AnalyticsKind;
  children: ReactNode;
  /** The table-view toggle — the accessibility twin of every chart. */
  tableHeaders?: string[];
  tableRows?: (string | number)[][];
}

export function ChartCard({
  title,
  subtitle,
  kind,
  children,
  tableHeaders,
  tableRows,
}: ChartCardProps) {
  return (
    <Surface as="figure" className="min-w-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-content">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <KindBadge kind={kind} />
      </div>
      {children}
      {tableHeaders && tableRows && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted transition-colors hover:text-secondary">
            View as table
          </summary>
          <div className="scroll-thin mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted">
                  {tableHeaders.map((h) => (
                    <th key={h} className="border-b border-edge py-1.5 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular">
                {tableRows.map((row, i) => (
                  <tr key={i} className="text-secondary">
                    {row.map((cell, j) => (
                      <td key={j} className="border-b border-divider py-1.5 pr-4">
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
    </Surface>
  );
}
