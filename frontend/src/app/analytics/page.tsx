"use client";

import Link from "next/link";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export default function AnalyticsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">Analytics dashboard</h1>
          <p className="text-xs text-slate-500">What&apos;s happening, why, and how severe — computed from live simulation state</p>
        </div>
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">
          ← Back to map
        </Link>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <AnalyticsDashboard />
      </main>
    </div>
  );
}
