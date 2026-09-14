import type { AnalyticsRange } from "@/domain/trainsim/analytics";

interface TimeRangePickerProps {
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  customFromLocal: string;
  customToLocal: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}

const OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: "CURRENT_HOUR", label: "Current sim hour" },
  { value: "FULL", label: "Full simulation" },
  { value: "CUSTOM", label: "Custom range" },
];

export function TimeRangePicker({
  range,
  onRangeChange,
  customFromLocal,
  customToLocal,
  onCustomFromChange,
  onCustomToChange,
}: TimeRangePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex overflow-hidden rounded-md border border-slate-800">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onRangeChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              range === opt.value ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {range === "CUSTOM" && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <label className="flex items-center gap-1">
            From
            <input
              type="datetime-local"
              value={customFromLocal}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-200"
            />
          </label>
          <label className="flex items-center gap-1">
            To
            <input
              type="datetime-local"
              value={customToLocal}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-slate-200"
            />
          </label>
        </div>
      )}
    </div>
  );
}
