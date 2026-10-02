"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  weekStart: Date;
  runsByDay: Map<string, number>;
  selectedDayYmd: string | null;
  onSelectDay: (ymd: string | null) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
};

export function RunManageWeekStrip({
  weekStart,
  runsByDay,
  selectedDayYmd,
  onSelectDay,
  onPrevWeek,
  onNextWeek,
}: Props) {
  const now = new Date();
  const todayYmd = ymdLocal(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const rangeLabel = `${weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Calendar</h2>
          <p className="text-xs text-gray-500">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrevWeek}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d, i) => {
          const key = ymdLocal(d);
          const count = runsByDay.get(key) ?? 0;
          const isToday = todayYmd === key;
          const selected = selectedDayYmd === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(selected ? null : key)}
              className={`min-h-[4.5rem] rounded-lg border p-2 text-left transition-colors ${
                selected
                  ? "border-sky-500 bg-sky-50 ring-1 ring-sky-400"
                  : isToday
                    ? "border-orange-300 bg-orange-50/50"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase text-gray-500">{DAY_LABELS[i]}</p>
              <p className="text-xs font-medium text-gray-800">{d.getDate()}</p>
              {count > 0 ? (
                <p className="mt-1 text-[10px] font-semibold text-sky-700">
                  {count} run{count === 1 ? "" : "s"}
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-gray-400">—</p>
              )}
            </button>
          );
        })}
      </div>
      {selectedDayYmd ? (
        <button
          type="button"
          onClick={() => onSelectDay(null)}
          className="mt-2 text-xs font-medium text-sky-700 hover:underline"
        >
          Clear day filter
        </button>
      ) : null}
    </section>
  );
}
