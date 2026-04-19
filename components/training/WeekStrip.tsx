"use client";

import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";

type Props = {
  days: PlanDayCard[];
  todayKey: string;
  selectedDateKey: string;
  onSelectDay: (day: PlanDayCard) => void;
};

export default function WeekStrip({ days, todayKey, selectedDateKey, onSelectDay }: Props) {
  if (!days.length) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
      {days.map((d) => {
        const isToday = d.dateKey === todayKey;
        const selected = d.dateKey === selectedDateKey;
        return (
          <button
            key={d.dateKey}
            type="button"
            onClick={() => onSelectDay(d)}
            className={[
              "shrink-0 min-w-[3.25rem] sm:min-w-[3.75rem] rounded-xl border px-2 py-2 text-center transition",
              selected
                ? "border-orange-400 bg-orange-50 shadow-sm ring-1 ring-orange-200"
                : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50",
              isToday && !selected ? "ring-1 ring-orange-300/60" : "",
            ].join(" ")}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {formatPlanDateDisplay(d.dateKey || String(d.date), { weekday: "short" })}
            </div>
            <div className="text-sm font-bold tabular-nums text-gray-900 mt-0.5">
              {formatPlanDateDisplay(d.dateKey || String(d.date), { day: "numeric" })}
            </div>
            {d.matchedActivityId ? (
              <div className="text-[10px] font-medium text-emerald-600 mt-0.5">Done</div>
            ) : (
              <div className="text-[10px] text-transparent mt-0.5 select-none">—</div>
            )}
          </button>
        );
      })}
    </div>
  );
}
