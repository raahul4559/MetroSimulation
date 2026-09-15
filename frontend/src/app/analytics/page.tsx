import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export const metadata = {
  title: "Analytics — Namma Metro",
};

/**
 * Deliberately outside the `(live)` route group: analytics polls its own aggregated endpoint and
 * has no use for the live train socket, so this route never opens one.
 */
export default function AnalyticsPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-content">Analytics</h1>
        <p className="mt-1 text-xs text-secondary">
          What&apos;s happening, why, and how severe — computed from live simulation state.
        </p>
      </header>
      <AnalyticsDashboard />
    </main>
  );
}
