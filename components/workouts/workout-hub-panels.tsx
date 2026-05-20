"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { metersToMiDisplay } from "@/lib/training/workout-preview-payload";

export type LastLoggedWorkout = {
  id: string;
  title: string;
  workoutType: string;
  date: string | null;
  planId: string | null;
  actualAvgPaceSecPerMile: number | null;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  estimatedDistanceInMeters: number | null;
  paceDeltaSecPerMile: number | null;
  targetPaceSecPerMile: number | null;
  hrDeltaBpm: number | null;
  creditedFiveKPaceSecPerMile: number | null;
  activityStartTime: string | null;
};

/** Row from GET /api/activities */
export type ActivitySummaryRow = {
  id: string;
  activityType: string | null;
  activityName: string | null;
  startTime: string | null;
  duration: number | null;
  distance: number | null;
  averageSpeed: number | null;
  averageHeartRate: number | null;
};

export function fallbackActivityToSummaryRow(a: {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  distance: number | null;
  duration: number | null;
}): ActivitySummaryRow {
  return {
    id: a.id,
    activityName: a.activityName,
    activityType: a.activityType,
    startTime: a.startTime,
    duration: a.duration,
    distance: a.distance,
    averageSpeed: null,
    averageHeartRate: null,
  };
}

function formatSecPerMileDisplay(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}/mi`;
}

function lastRunDayLabel(activityStartTime: string | null, date: string | null): string {
  const raw = activityStartTime ?? date;
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** Pace delta sec/mi: >5 beat, <-5 missed, else on target band */
function paceBandLabel(paceDeltaSecPerMile: number | null | undefined): string | null {
  const p = paceDeltaSecPerMile;
  if (p == null || !Number.isFinite(p)) return null;
  if (p > 5) return "Beat target";
  if (p < -5) return "Missed target";
  return "On target";
}

/** paceDeltaSecPerMile = target − actual (positive ⇒ faster than prescribed). */
function versusTargetPhrase(deltaSecPerMile: number | null | undefined): string | null {
  if (deltaSecPerMile == null || !Number.isFinite(deltaSecPerMile)) return null;
  const n = Math.round(deltaSecPerMile);
  const abs = Math.abs(n);
  if (n > 0) return `${abs} sec/mi faster than target`;
  if (n < 0) return `${abs} sec/mi slower than target`;
  return "On target pace";
}

function formatDurationFromSeconds(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m <= 0) return null;
  return `${m} min`;
}

/** m/s → seconds per mile (same as training matcher) */
function speedMpsToSecPerMile(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0) return null;
  return Math.round(1609.34 / mps);
}

function activityRowPaceDisplay(row: ActivitySummaryRow): string | null {
  const sec = speedMpsToSecPerMile(row.averageSpeed);
  if (sec != null) return formatSecPerMileDisplay(sec);
  return null;
}

function activityRowDistanceMi(row: ActivitySummaryRow): string | null {
  if (row.distance == null || row.distance <= 0) return null;
  return metersToMiDisplay(row.distance);
}

export function LastRunPanelSkeleton() {
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse"
      aria-hidden
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded bg-gray-200" />
        <div className="h-4 w-36 rounded bg-gray-200" />
      </div>
      <div className="h-4 max-w-md w-full rounded bg-gray-100 mb-2" />
      <div className="h-3 w-20 rounded bg-gray-100 mb-3" />
      <div className="h-4 w-full max-w-lg rounded bg-gray-100 mb-2" />
      <div className="h-4 w-2/3 max-w-sm rounded bg-gray-100" />
    </section>
  );
}

function paceBandBadgeClasses(band: string | null): string {
  if (band === "Beat target") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (band === "Missed target") return "bg-amber-100 text-amber-900 border-amber-200";
  if (band === "On target") return "bg-slate-100 text-slate-800 border-slate-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export function LastRunPanel({ workout, children }: { workout: LastLoggedWorkout; children?: ReactNode }) {
  const day = lastRunDayLabel(workout.activityStartTime, workout.date);
  const actual = workout.actualAvgPaceSecPerMile;
  const delta = workout.paceDeltaSecPerMile;
  const band = paceBandLabel(delta);
  const versus = versusTargetPhrase(delta);
  const duration = formatDurationFromSeconds(workout.actualDurationSeconds);
  const distMi =
    workout.actualDistanceMeters != null && workout.actualDistanceMeters > 0
      ? metersToMiDisplay(workout.actualDistanceMeters)
      : workout.estimatedDistanceInMeters != null && workout.estimatedDistanceInMeters > 0
        ? `~${metersToMiDisplay(workout.estimatedDistanceInMeters)}`
        : null;

  return (
    <section className="rounded-2xl border-2 border-orange-100 bg-gradient-to-br from-white to-orange-50/40 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-800">Last run</h2>
          <p className="mt-1 text-lg font-bold text-gray-900">{workout.title}</p>
          {day ? <p className="text-sm text-gray-600 mt-0.5">{day}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {band ? (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${paceBandBadgeClasses(band)}`}
            >
              {band}
            </span>
          ) : null}
          <Link
            href={`/workouts/${workout.id}`}
            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Full session →
          </Link>
        </div>
      </div>
      {workout.workoutType ? (
        <span className="inline-block rounded-md bg-orange-100/80 px-2 py-0.5 text-xs font-medium text-orange-900 capitalize">
          {String(workout.workoutType).toLowerCase()}
        </span>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        {distMi ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Distance</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{distMi}</dd>
          </div>
        ) : null}
        {actual != null ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Avg pace</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">
              {formatSecPerMileDisplay(actual)}
            </dd>
          </div>
        ) : null}
        {duration ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Duration</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">{duration}</dd>
          </div>
        ) : null}
        {workout.targetPaceSecPerMile != null && workout.targetPaceSecPerMile > 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white/80 px-3 py-2">
            <dt className="text-xs font-medium text-gray-500">Target pace</dt>
            <dd className="font-semibold text-gray-900 tabular-nums">
              {formatSecPerMileDisplay(workout.targetPaceSecPerMile)}
            </dd>
          </div>
        ) : null}
      </dl>
      {versus != null ? (
        <p className="mt-4 text-sm text-gray-800">
          <span className="font-medium text-gray-900">vs plan: </span>
          {versus}
        </p>
      ) : null}
      {workout.hrDeltaBpm != null ? (
        <p className="mt-2 text-sm text-gray-700">
          <span className="font-medium text-gray-900">Heart rate: </span>
          {workout.hrDeltaBpm > 0
            ? `${workout.hrDeltaBpm} bpm under zone midpoint`
            : workout.hrDeltaBpm < 0
              ? `${Math.abs(workout.hrDeltaBpm)} bpm above zone midpoint`
              : "on midpoint"}
        </p>
      ) : null}
      {children ? <div className="mt-6 border-t border-gray-100 pt-5">{children}</div> : null}
    </section>
  );
}

/** When no workout match yet — show latest Garmin row only */
export function LastActivityFallbackPanel({ row }: { row: ActivitySummaryRow }) {
  const day = row.startTime
    ? new Date(row.startTime).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  const dist = activityRowDistanceMi(row);
  const pace = activityRowPaceDisplay(row);
  const dur = formatDurationFromSeconds(row.duration);
  const label = row.activityName?.trim() || row.activityType || "Activity";

  return (
    <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last run</h2>
        <Link
          href={`/activities/${row.id}`}
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          Details →
        </Link>
      </div>
      <p className="text-lg font-bold text-gray-900">{label}</p>
      {day ? <p className="text-sm text-gray-600 mt-1">{day}</p> : null}
      <p className="mt-3 text-sm text-gray-600">
        From your watch — not linked to a plan workout yet. Open the session to see full stats; when
        it matches a scheduled workout, pace analysis appears here.
      </p>
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {dist ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">Distance</dt>
            <dd className="font-semibold text-gray-900">{dist}</dd>
          </div>
        ) : null}
        {pace ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">Avg pace</dt>
            <dd className="font-semibold text-gray-900">{pace}</dd>
          </div>
        ) : null}
        {dur ? (
          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">Duration</dt>
            <dd className="font-semibold text-gray-900">{dur}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function RunHistoryPanel({ rows }: { rows: ActivitySummaryRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Run history
        </h2>
        <p className="text-sm text-gray-600">
          No activities synced yet. Connect Garmin in settings and sync, or check back after your
          next run.
        </p>
        <Link
          href="/settings/garmin"
          className="mt-3 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          Garmin settings →
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Run history</h2>
        <Link
          href="/activities"
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => {
          const day = row.startTime
            ? new Date(row.startTime).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : "—";
          const type = row.activityType?.replace(/_/g, " ") ?? "Run";
          const dist = activityRowDistanceMi(row);
          const pace = activityRowPaceDisplay(row);
          const parts = [dist, pace].filter(Boolean);
          return (
            <li key={row.id}>
              <Link
                href={`/activities/${row.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm hover:bg-gray-50/80 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className="font-medium text-gray-900 min-w-0">
                  {row.activityName?.trim() || type}
                  <span className="font-normal text-gray-500"> · {day}</span>
                </span>
                <span className="text-gray-600 tabular-nums shrink-0">
                  {parts.length > 0 ? parts.join(" · ") : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AnalysisPanel({ workout }: { workout: LastLoggedWorkout }) {
  const hasPace = workout.paceDeltaSecPerMile != null && Number.isFinite(workout.paceDeltaSecPerMile);
  const hasHr = workout.hrDeltaBpm != null && Number.isFinite(workout.hrDeltaBpm);
  const hasCredit =
    workout.creditedFiveKPaceSecPerMile != null &&
    workout.creditedFiveKPaceSecPerMile > 0;

  if (!hasPace && !hasHr && !hasCredit) {
    return null;
  }

  const versus = versusTargetPhrase(workout.paceDeltaSecPerMile);
  const band = paceBandLabel(workout.paceDeltaSecPerMile);

  return (
    <section className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Analysis</h2>
          <p className="mt-1 text-base font-semibold text-gray-900">How this session stacked up</p>
          <p className="text-sm text-gray-600 mt-0.5">{workout.title}</p>
        </div>
        {band ? (
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${paceBandBadgeClasses(band)}`}
          >
            {band}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 text-sm text-gray-800">
        {hasPace && versus ? (
          <p>
            <span className="font-semibold text-gray-900">Pace: </span>
            {versus}
            {workout.targetPaceSecPerMile != null && workout.targetPaceSecPerMile > 0 ? (
              <span className="text-gray-600">
                {" "}
                (target {formatSecPerMileDisplay(workout.targetPaceSecPerMile)})
              </span>
            ) : null}
          </p>
        ) : null}
        {hasHr ? (
          <p>
            <span className="font-semibold text-gray-900">Heart rate: </span>
            {workout.hrDeltaBpm! > 0
              ? `${workout.hrDeltaBpm} bpm under the prescribed zone midpoint`
              : workout.hrDeltaBpm! < 0
                ? `${Math.abs(workout.hrDeltaBpm!)} bpm above the zone midpoint`
                : "Right on the zone midpoint"}
          </p>
        ) : null}
        {hasCredit ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-emerald-950">
            <span className="font-semibold">5K pace signal: </span>
            this effort implies about{" "}
            <span className="font-bold tabular-nums">
              {formatSecPerMileDisplay(workout.creditedFiveKPaceSecPerMile)}
            </span>{" "}
            /mi at 5K — we may use this to tune your plan when quality targets are met.
          </p>
        ) : null}
      </div>
      <Link
        href={`/workouts/${workout.id}`}
        className="mt-4 inline-block text-sm font-semibold text-orange-600 hover:text-orange-700"
      >
        Open full breakdown →
      </Link>
    </section>
  );
}
