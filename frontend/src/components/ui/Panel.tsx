import type { PropsWithChildren, ReactNode } from "react";

interface PanelProps extends PropsWithChildren {
  title: string;
  action?: ReactNode;
}

export function Panel({ title, action, children }: PanelProps) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
