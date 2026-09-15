"use client";

import type { AnalyticsRange } from "@/domain/trainsim/analytics";
import { SegmentedControl, type SegmentOption } from "@/components/ui/SegmentedControl";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

interface TimeRangePickerProps {
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  customFromLocal: string;
  customToLocal: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
}

const OPTIONS: readonly SegmentOption<AnalyticsRange>[] = [
  { value: "CURRENT_HOUR", label: "Current sim hour" },
  { value: "FULL", label: "Full simulation" },
  { value: "CUSTOM", label: "Custom range" },
];

/** Fully controlled — it holds no state of its own, so the dashboard stays the single owner of
 * what range is being analysed. */
export function TimeRangePicker({
  range,
  onRangeChange,
  customFromLocal,
  customToLocal,
  onCustomFromChange,
  onCustomToChange,
}: TimeRangePickerProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <SegmentedControl
        options={OPTIONS}
        value={range}
        onChange={onRangeChange}
        ariaLabel="Analytics time range"
      />
      {range === "CUSTOM" && (
        <div className="flex items-end gap-2">
          <Field label="From" className="w-[190px]">
            <Input
              type="datetime-local"
              value={customFromLocal}
              onChange={(e) => onCustomFromChange(e.target.value)}
            />
          </Field>
          <Field label="To" className="w-[190px]">
            <Input
              type="datetime-local"
              value={customToLocal}
              onChange={(e) => onCustomToChange(e.target.value)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
