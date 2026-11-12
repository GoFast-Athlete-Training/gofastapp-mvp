import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";
import { typeLabelForCard } from "@/lib/training/plan-day-card-display";
import { formatPlanDateDisplay } from "@/lib/training/plan-utils";

const MI_PER_M = 1609.34;

/** Show the number inside a slice only when it owns enough of the bar to read. */
const SLICE_LABEL_MIN_SHARE = 0.12;

type StackedProps = {
  variant?: "stacked";
  days: PlanDayCard[];
  /** Saved weekly target. Shown only when it differs from the scheduled sum. */
  weeklyMileageTarget?: number | null;
};

type ProgressProps = {
  variant: "progress";
  actualMiles: number;
  plannedMiles: number;
};

export type WeekMileageBarProps = StackedProps | ProgressProps;

type Slice = {
  key: string;
  miles: number;
  workoutType: string;
  weekday: string;
  typeLabel: string;
};

function formatMilesNumber(mi: number): string {
  if (!Number.isFinite(mi) || mi <= 0) return "0";
  const rounded =
    Math.abs(mi - Math.round(mi)) < 0.06 ? Math.round(mi) : Math.round(mi * 10) / 10;
  return String(rounded);
}

function milesFromMeters(meters: number | null | undefined): number {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return 0;
  return meters / MI_PER_M;
}

function slicesFromDays(days: PlanDayCard[]): Slice[] {
  return [...days]
    .filter((day) => milesFromMeters(day.estimatedDistanceInMeters) > 0)
    .sort((a, b) => (a.dateKey || a.date).localeCompare(b.dateKey || b.date))
    .map((day) => {
      const dateKey = day.dateKey || day.date;
      return {
        key: dateKey || `${day.workoutType}-${day.title}`,
        miles: milesFromMeters(day.estimatedDistanceInMeters),
        workoutType: day.workoutType,
        weekday: dateKey
          ? formatPlanDateDisplay(dateKey, { weekday: "short" })
          : typeLabelForCard(day.workoutType),
        typeLabel: typeLabelForCard(day.workoutType),
      };
    });
}

function WeekMileageProgress({
  actualMiles,
  plannedMiles,
}: {
  actualMiles: number;
  plannedMiles: number;
}) {
  if (!Number.isFinite(plannedMiles) || plannedMiles <= 0) return null;
  const actual = Number.isFinite(actualMiles) && actualMiles > 0 ? actualMiles : 0;
  const pct = Math.min(100, (actual / plannedMiles) * 100);
  const actualLabel = formatMilesNumber(actual);
  const plannedLabel = formatMilesNumber(plannedMiles);

  return (
    <div>
      <p className="text-3xl font-bold tabular-nums text-gray-900">
        {actualLabel} of {plannedLabel}
        <span className="ml-2 text-base font-semibold text-gray-600">mi</span>
      </p>
      <div
        className="mt-2 h-10 w-full overflow-hidden rounded-xl bg-orange-100"
        aria-hidden
      >
        <div
          className="h-full rounded-xl bg-orange-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WeekMileageStacked({
  days,
  weeklyMileageTarget,
}: {
  days: PlanDayCard[];
  weeklyMileageTarget?: number | null;
}) {
  const slices = slicesFromDays(days);
  const total = slices.reduce((sum, slice) => sum + slice.miles, 0);
  if (total <= 0) return null;

  const totalLabel = formatMilesNumber(total);
  const scheduledRounded = Math.round(total);
  const targetRounded =
    weeklyMileageTarget != null && Number.isFinite(weeklyMileageTarget)
      ? Math.round(weeklyMileageTarget)
      : null;
  const showTargetGap = targetRounded != null && targetRounded !== scheduledRounded;
  return (
    <div>
      <p className="text-3xl font-bold tabular-nums text-gray-900">
        {totalLabel}
        <span className="ml-2 text-base font-semibold text-gray-600">mi planned</span>
      </p>
      <div
        className="mt-2 flex h-10 w-full gap-0.5 overflow-hidden rounded-xl"
        aria-hidden
      >
        {slices.map((slice) => {
          const share = slice.miles / total;
          const milesLabel = formatMilesNumber(slice.miles);
          return (
            <div
              key={slice.key}
              className="flex h-full min-w-0 items-center justify-center overflow-hidden bg-orange-500 text-xs font-semibold text-white"
              style={{ flexGrow: slice.miles, flexBasis: 0 }}
              title={`${slice.weekday} · ${slice.typeLabel} · ${milesLabel} mi`}
            >
              {share >= SLICE_LABEL_MIN_SHARE ? milesLabel : null}
            </div>
          );
        })}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-700">
        {slices.map((slice) => (
          <li key={slice.key} className="tabular-nums">
            {slice.weekday} · {slice.typeLabel} · {formatMilesNumber(slice.miles)}
          </li>
        ))}
      </ul>
      {showTargetGap ? (
        <p className="mt-1 text-sm tabular-nums text-gray-600">
          Target {targetRounded} · scheduled {scheduledRounded}
        </p>
      ) : null}
    </div>
  );
}

export function WeekMileageBar(props: WeekMileageBarProps) {
  if (props.variant === "progress") {
    return (
      <WeekMileageProgress
        actualMiles={props.actualMiles}
        plannedMiles={props.plannedMiles}
      />
    );
  }
  return (
    <WeekMileageStacked
      days={props.days}
      weeklyMileageTarget={props.weeklyMileageTarget}
    />
  );
}
