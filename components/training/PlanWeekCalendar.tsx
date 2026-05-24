"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";
import type { WeekSummary } from "@/lib/training/week-summary-service";
import {
  workoutCardPrimaryName,
  workoutCardSubtypeLine,
  workoutTypeLeftBorderClass,
} from "@/lib/training/plan-day-card-display";
import {
  deriveSessionStatus,
  sessionStatusBadgeClass,
  sessionStatusLabel,
} from "@/lib/training/session-status";
import WeekStrip from "@/components/training/WeekStrip";

type Props = {
  weekNumber: number;
  totalWeeks: number;
  days: PlanDayCard[];
  loading?: boolean;
  todayKey: string;
  selectedDateKey: string;
  calendarRangeLabel?: string;
  summary: WeekSummary | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSelectDay: (day: PlanDayCard) => void;
  /** Detail panel rendered below cards for the selected day */
  selectedDayDetail?: ReactNode;
  /** Hide full card list on small screens when detail is showing */
  collapseCardsOnMobile?: boolean;
  /** Section label; pass null to hide (hub mode). */
  sectionLabel?: string | null;
  /** When false, calendar range is shown only in the hub goal strip. */
  showCalendarRangeLabel?: boolean;
};

export default function PlanWeekCalendar({
  weekNumber,
  totalWeeks,
  days,
  loading = false,
  todayKey,
  selectedDateKey,
  calendarRangeLabel,
  summary,
  onPrevWeek,
  onNextWeek,
  onSelectDay,
  selectedDayDetail,
  collapseCardsOnMobile = false,
  sectionLabel = "This week",
  showCalendarRangeLabel = true,
}: Props) {
  const atFirstWeek = weekNumber <= 1;
  const atLastWeek = weekNumber >= totalWeeks;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {sectionLabel ? (
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {sectionLabel}
            </p>
          ) : null}
          {summary ? (
            <>
              <p
                className={`${sectionLabel ? "mt-1" : ""} text-lg font-semibold text-gray-900 sm:text-xl`}
              >
                {summary.headline}
              </p>
              <p className="mt-1 text-sm text-gray-700 leading-relaxed">{summary.narrative}</p>
              {summary.chips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {summary.chips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p
              className={`${sectionLabel ? "mt-1" : ""} text-lg font-semibold text-gray-900 sm:text-xl`}
            >
              Week {weekNumber} of {totalWeeks}
            </p>
          )}
          {showCalendarRangeLabel && calendarRangeLabel ? (
            <p className="mt-2 text-sm text-gray-500">{calendarRangeLabel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onPrevWeek}
            disabled={atFirstWeek || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Prev</span>
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            disabled={atLastWeek || loading}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            aria-label="Next week"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>
      </div>

      {loading && days.length === 0 ? (
        <p className="text-sm text-gray-500">Loading this week&apos;s sessions…</p>
      ) : null}

      {!loading && days.length === 0 ? (
        <p className="text-sm text-gray-500">No sessions scheduled for this week.</p>
      ) : null}

      {days.length > 0 ? (
        <WeekStrip
          days={days}
          todayKey={todayKey}
          selectedDateKey={selectedDateKey}
          onSelectDay={onSelectDay}
        />
      ) : null}

      {days.length > 0 ? (
        <ul
          className={`space-y-2 ${collapseCardsOnMobile && selectedDayDetail ? "hidden sm:block" : ""}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            This week&apos;s workouts
          </p>
          {days.map((w) => {
            const selected = w.dateKey === selectedDateKey;
            const status = deriveSessionStatus({
              dateKey: w.dateKey,
              matchedActivityId: w.matchedActivityId,
              skippedAt: w.skippedAt,
              workoutType: w.workoutType,
              title: w.title,
            });
            const statusLabel = status === "rest" ? null : sessionStatusLabel(status);
            return (
              <li key={w.dateKey}>
                <button
                  type="button"
                  onClick={() => onSelectDay(w)}
                  className={[
                    "block w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm transition",
                    selected
                      ? "border-orange-300 ring-1 ring-orange-200 shadow-md"
                      : "border-gray-100 hover:border-orange-200 hover:shadow-md",
                  ].join(" ")}
                >
                  <div className="flex min-h-[4rem]">
                    <div
                      className={`w-1.5 shrink-0 ${workoutTypeLeftBorderClass(w.workoutType)}`}
                    />
                    <div className="flex flex-1 flex-col px-4 py-2.5 sm:py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-gray-500">
                          {w.date
                            ? formatPlanDateDisplay(w.date, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </p>
                        {statusLabel ? (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sessionStatusBadgeClass(status)}`}
                          >
                            {statusLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-base font-semibold leading-snug text-gray-900">
                        {workoutCardPrimaryName(w)}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500">{workoutCardSubtypeLine(w)}</p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selectedDayDetail ? <div className="pt-1">{selectedDayDetail}</div> : null}
    </div>
  );
}
