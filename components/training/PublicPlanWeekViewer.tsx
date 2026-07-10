"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicPlanWeek } from "@/lib/training/public-plan-service";
import {
  formatWeekCardMiles,
  typeLabelForCard,
  workoutCardPrimaryName,
  workoutTypeLeftBorderClass,
} from "@/lib/training/plan-day-card-display";
import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";

type Props = {
  weeks: PublicPlanWeek[];
  totalWeeks: number;
  ctaHref?: string;
  ctaLabel?: string;
};

function toPlanDayCard(day: PublicPlanWeek["days"][number]): PlanDayCard {
  return {
    workoutId: null,
    dateKey: day.dateKey,
    date: day.dateKey,
    title: day.title,
    workoutType: day.workoutType,
    phase: "",
    dayAssigned: day.dayAssigned,
    estimatedDistanceInMeters: day.estimatedDistanceInMeters,
    matchedActivityId: null,
    skippedAt: null,
    skipReason: null,
    actualDistanceMeters: null,
    actualAvgPaceSecPerMile: null,
    actualAverageHeartRate: null,
    actualDurationSeconds: null,
  };
}

export default function PublicPlanWeekViewer({
  weeks,
  totalWeeks,
  ctaHref = "/welcome",
  ctaLabel = "Start this plan in GoFast",
}: Props) {
  const [weekNumber, setWeekNumber] = useState(1);
  const week = useMemo(
    () => weeks.find((w) => w.weekNumber === weekNumber) ?? weeks[0] ?? null,
    [weekNumber, weeks]
  );
  const atFirstWeek = weekNumber <= 1;
  const atLastWeek = weekNumber >= totalWeeks;

  if (!week) {
    return (
      <p className="text-sm text-gray-500">Schedule preview is not available for this plan yet.</p>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Week {week.weekNumber} of {totalWeeks}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {week.totalMiles > 0 ? `${week.totalMiles} mi planned this week` : "Weekly mileage TBD"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekNumber((n) => Math.max(1, n - 1))}
            disabled={atFirstWeek}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Prev</span>
          </button>
          <button
            type="button"
            onClick={() => setWeekNumber((n) => Math.min(totalWeeks, n + 1))}
            disabled={atLastWeek}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Next week"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {week.days.map((d) => {
          const card = toPlanDayCard(d);
          const miles = formatWeekCardMiles(d.estimatedDistanceInMeters);
          return (
            <li key={d.dateKey}>
              <div className="flex overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className={`w-1.5 shrink-0 ${workoutTypeLeftBorderClass(d.workoutType)}`} />
                <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">
                      {d.dayAssigned ?? typeLabelForCard(d.workoutType)}
                    </p>
                    <p className="font-semibold text-gray-900 truncate">
                      {workoutCardPrimaryName(card)}
                    </p>
                  </div>
                  {miles ? <p className="shrink-0 text-sm font-medium text-gray-600">{miles}</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="pt-2 border-t border-gray-100">
        <Link
          href={ctaHref}
          className="inline-flex w-full sm:w-auto justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
