"use client";

import { useMemo } from "react";
import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";
import { workoutTypeStripSurfaceClass } from "@/lib/training/plan-day-card-display";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import {
  deriveSessionStatus,
  sessionStatusLabel,
} from "@/lib/training/session-status";

type Props = {
  days: PlanDayCard[];
  todayKey: string;
  selectedDateKey: string;
  onSelectDay: (day: PlanDayCard) => void;
};

type StripDayItem = {
  dateKey: string;
  planDay: PlanDayCard | null;
  isRest: boolean;
};

function parseDateKeyLocal(dateKey: string): Date {
  const base = dateKey.trim().slice(0, 10);
  return new Date(`${base}T12:00:00`);
}

function localYmdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function mondayOfWeekContaining(dateKey: string): Date {
  const d = parseDateKeyLocal(dateKey);
  const jsDay = d.getDay();
  const daysBack = jsDay === 0 ? 6 : jsDay - 1;
  return addDaysLocal(d, -daysBack);
}

/** Full Mon–Sun strip from scheduled workout days (inserts rest placeholders). */
export function buildWeekWorkoutWidgetDays(days: PlanDayCard[]): StripDayItem[] {
  if (!days.length) return [];

  const byKey = new Map<string, PlanDayCard>();
  for (const d of days) {
    if (d.dateKey) byKey.set(d.dateKey, d);
  }

  const sortedKeys = [...byKey.keys()].sort();
  const weekMonday = mondayOfWeekContaining(sortedKeys[0]!);
  const strip: StripDayItem[] = [];

  for (let i = 0; i < 7; i++) {
    const dateKey = localYmdFromDate(addDaysLocal(weekMonday, i));
    const planDay = byKey.get(dateKey) ?? null;
    strip.push({
      dateKey,
      planDay,
      isRest: planDay == null,
    });
  }

  return strip;
}

function statusTextColor(status: ReturnType<typeof deriveSessionStatus>): string {
  switch (status) {
    case "completed":
      return "text-emerald-600";
    case "missed":
      return "text-red-600";
    case "skipped":
      return "text-neutral-500";
    case "today":
      return "text-orange-600";
    case "upcoming":
      return "text-sky-600";
    case "rest":
      return "text-neutral-500";
    default:
      return "text-transparent";
  }
}

function stripCellClasses(params: {
  workoutType: string;
  selected: boolean;
  isToday: boolean;
  isRest: boolean;
}): string {
  const { workoutType, selected, isToday, isRest } = params;
  const surface = isRest ? workoutTypeStripSurfaceClass("Rest") : workoutTypeStripSurfaceClass(workoutType);
  return [
    "shrink-0 min-w-[3.25rem] sm:min-w-[3.75rem] rounded-xl border px-2 py-2 text-center transition",
    surface,
    selected ? "shadow-sm ring-2 ring-orange-400 border-orange-300" : "",
    isToday && !selected ? "ring-1 ring-orange-300/70" : "",
    isRest ? "cursor-default" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function WeekWorkoutWidget({ days, todayKey, selectedDateKey, onSelectDay }: Props) {
  const stripDays = useMemo(() => buildWeekWorkoutWidgetDays(days), [days]);

  if (!stripDays.length) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
      {stripDays.map((item) => {
        const { dateKey, planDay, isRest } = item;
        const isToday = dateKey === todayKey;
        const selected = dateKey === selectedDateKey;
        const workoutType = planDay?.workoutType ?? "Rest";

        const status = isRest
          ? ("rest" as const)
          : deriveSessionStatus({
              dateKey,
              matchedActivityId: planDay!.matchedActivityId,
              skippedAt: planDay!.skippedAt,
              workoutType: planDay!.workoutType,
              title: planDay!.title,
            });
        const statusText = sessionStatusLabel(status);
        const statusColor = statusTextColor(status);

        const cellClass = stripCellClasses({
          workoutType,
          selected,
          isToday,
          isRest,
        });

        const inner = (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {formatPlanDateDisplay(dateKey, { weekday: "short" })}
            </div>
            <div className="text-sm font-bold tabular-nums text-gray-900 mt-0.5">
              {formatPlanDateDisplay(dateKey, { day: "numeric" })}
            </div>
            <div className={`text-[10px] font-medium mt-0.5 ${statusColor}`}>{statusText}</div>
          </>
        );

        if (isRest) {
          return (
            <div key={dateKey} className={cellClass} aria-label={`${dateKey} rest day`}>
              {inner}
            </div>
          );
        }

        return (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDay(planDay!)}
            className={`${cellClass} hover:brightness-[0.98]`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
