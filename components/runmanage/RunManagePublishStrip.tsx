"use client";

import { formatDayLabel } from "@/lib/runmanage/format-day-label";
import { formatInstanceDateLabel } from "@/components/runmanage/runInstanceWizard/shared";

type Props = {
  dateYmd: string;
  dayOfWeek?: string | null;
  startTimeHour: string;
  startTimeMinute: string;
  startTimePeriod: string;
  meetUpPoint: string;
};

function formatStartTime(hour: string, minute: string, period: string): string {
  const h = hour.trim();
  const m = minute.trim();
  if (!h && !m) return "—";
  const min = m.padStart(2, "0");
  return `${h}:${min}${period?.trim() ? ` ${period.trim()}` : ""}`;
}

export default function RunManagePublishStrip({
  dateYmd,
  dayOfWeek,
  startTimeHour,
  startTimeMinute,
  startTimePeriod,
  meetUpPoint,
}: Props) {
  const dateLabel = dateYmd.trim() ? formatInstanceDateLabel(dateYmd.trim()) : "Date not set";
  const dayLabel = dayOfWeek?.trim() ? formatDayLabel(dayOfWeek) : null;
  const timeLabel = formatStartTime(startTimeHour, startTimeMinute, startTimePeriod);
  const meetUp = meetUpPoint.trim();
  const ready = Boolean(dateYmd.trim() && meetUp && startTimeHour.trim());

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <span className="font-medium text-gray-900">
        {dayLabel ? `${dayLabel} · ` : ""}
        {dateLabel}
      </span>
      <span className="text-gray-700">{timeLabel}</span>
      <span className="min-w-0 flex-1 truncate text-gray-800">{meetUp || "Meet-up not set"}</span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          ready
            ? "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-600/20"
            : "bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-600/20"
        }`}
      >
        {ready ? "Ready to publish" : meetUp ? "Missing date or start time" : "Missing meet-up"}
      </span>
    </div>
  );
}
