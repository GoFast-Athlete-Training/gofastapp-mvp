"use client";

import { useState } from "react";
import api from "@/lib/api";
import type { WhereYouStandSnapshot } from "@/lib/training/where-you-stand";

function PaceInput({
  label,
  current,
  proposed,
  value,
  onChange,
}: {
  label: string;
  current: string | null;
  proposed: string | null;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      {current ? (
        <p className="mt-1 text-sm text-gray-600">
          Current: <span className="font-semibold tabular-nums text-gray-900">{current}</span>
        </p>
      ) : null}
      {proposed && proposed !== current ? (
        <p className="mt-1 text-sm text-emerald-800">
          Our stack: <span className="font-semibold tabular-nums">{proposed}</span>
        </p>
      ) : null}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="7:30"
        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums"
      />
    </div>
  );
}

export function WhereYouStandPanel({
  stand,
  planId,
  weekNumber,
  onConfirmed,
}: {
  stand: WhereYouStandSnapshot;
  planId: string | null;
  weekNumber: number | null;
  onConfirmed: () => void;
}) {
  const [fiveK, setFiveK] = useState(stand.fiveK.proposedPace ?? stand.fiveK.currentPace ?? "");
  const [threshold, setThreshold] = useState(
    stand.threshold.proposedPace ?? stand.threshold.currentPace ?? ""
  );
  const [durabilityMiles, setDurabilityMiles] = useState(
    stand.durability.proposedMiles != null
      ? String(stand.durability.proposedMiles)
      : stand.durability.currentMiles != null
        ? String(stand.durability.currentMiles)
        : ""
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasAny =
    stand.fiveK.currentPace ||
    stand.threshold.currentPace ||
    stand.durability.currentMiles != null ||
    stand.fiveK.proposedPace ||
    stand.threshold.proposedPace ||
    stand.durability.proposedMiles != null;

  if (!hasAny) return null;

  async function confirm() {
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        planId,
        weekNumber,
        sourceWorkoutId:
          stand.fiveK.sourceWorkoutId ??
          stand.threshold.sourceWorkoutId ??
          stand.durability.sourceWorkoutId ??
          null,
      };
      if (fiveK.trim()) {
        const parts = fiveK.trim().split(":");
        if (parts.length === 2) {
          const sec = Math.round(Number(parts[0]) * 60 + Number(parts[1]));
          if (Number.isFinite(sec) && sec > 0) body.fiveKPaceSecPerMile = sec;
        }
      }
      if (threshold.trim()) {
        const parts = threshold.trim().split(":");
        if (parts.length === 2) {
          const sec = Math.round(Number(parts[0]) * 60 + Number(parts[1]));
          if (Number.isFinite(sec) && sec > 0) body.thresholdPaceSecPerMile = sec;
        }
      }
      if (durabilityMiles.trim()) {
        const miles = Number(durabilityMiles);
        if (Number.isFinite(miles) && miles > 0) {
          body.longRunCapabilityMiles = miles;
          if (stand.durability.proposedPaceSecPerMile != null) {
            body.longRunCapabilityPaceSecPerMile = stand.durability.proposedPaceSecPerMile;
          }
        }
      }
      const res = await api.post<{ ok?: boolean; result?: { reason?: string } }>(
        "/performance/confirm-stand",
        body
      );
      setMessage(res.data?.result?.reason ?? (res.data?.ok ? "Updated." : "Could not update."));
      if (res.data?.ok) onConfirmed();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-5 py-4 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-1">
        Where you stand
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        This is what our stack says. If you feel it&apos;s higher or lower, change it.
      </p>
      <div className="space-y-3">
        {(stand.fiveK.currentPace || stand.fiveK.proposedPace) && (
          <PaceInput
            label="5K pace"
            current={stand.fiveK.currentPace}
            proposed={stand.fiveK.proposedPace}
            value={fiveK}
            onChange={setFiveK}
          />
        )}
        {(stand.threshold.currentPace || stand.threshold.proposedPace) && (
          <PaceInput
            label="Threshold pace"
            current={stand.threshold.currentPace}
            proposed={stand.threshold.proposedPace}
            value={threshold}
            onChange={setThreshold}
          />
        )}
        {stand.durability.currentMiles != null || stand.durability.proposedMiles != null ? (
          <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Long-run durability
            </p>
            {stand.durability.currentMiles != null ? (
              <p className="mt-1 text-sm text-gray-600">
                Current:{" "}
                <span className="font-semibold tabular-nums">
                  {stand.durability.currentMiles.toFixed(1)} mi
                </span>
                {stand.durability.currentPace ? ` @ ${stand.durability.currentPace}` : ""}
              </p>
            ) : null}
            {stand.durability.proposedMiles != null &&
            stand.durability.proposedMiles !== stand.durability.currentMiles ? (
              <p className="mt-1 text-sm text-emerald-800">
                Our stack:{" "}
                <span className="font-semibold tabular-nums">
                  {stand.durability.proposedMiles.toFixed(1)} mi
                </span>
              </p>
            ) : null}
            <input
              type="text"
              value={durabilityMiles}
              onChange={(e) => setDurabilityMiles(e.target.value)}
              placeholder="16.0"
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums"
            />
          </div>
        ) : null}
        {stand.predicted?.proposedFinish || stand.predicted?.currentFinish ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
              Predicted finish
              {stand.predicted.goalRaceName ? ` · ${stand.predicted.goalRaceName}` : ""}
            </p>
            {stand.predicted.currentFinish ? (
              <p className="mt-1 text-sm text-gray-700">
                Current:{" "}
                <span className="font-semibold tabular-nums">{stand.predicted.currentFinish}</span>
              </p>
            ) : null}
            {stand.predicted.proposedFinish &&
            stand.predicted.proposedFinish !== stand.predicted.currentFinish ? (
              <p className="mt-1 text-sm text-violet-900">
                If you confirm above:{" "}
                <span className="font-semibold tabular-nums">{stand.predicted.proposedFinish}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={busy}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Confirm"}
      </button>
      {message ? <p className="mt-2 text-xs text-gray-600">{message}</p> : null}
    </section>
  );
}

export function PerformanceWeekPlan({
  weekDays,
  onOpenWorkout,
}: {
  weekDays: Array<{
    workoutId: string | null;
    dateKey: string;
    title: string;
    workoutType: string;
    status: string;
    statusLabel: string;
    paceDeltaSecPerMile: number | null;
  }>;
  onOpenWorkout: (workoutId: string) => void;
}) {
  if (weekDays.length === 0) return null;

  return (
    <section className="rounded-xl border border-orange-100 bg-orange-50/60 px-5 py-4 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">
        This week&apos;s plan
      </h2>
      <ul className="space-y-2">
        {weekDays.map((day) => (
          <li key={`${day.dateKey}-${day.title}`}>
            {day.workoutId && day.status === "completed" ? (
              <button
                type="button"
                onClick={() => onOpenWorkout(day.workoutId!)}
                className="w-full text-left rounded-lg border border-orange-200 bg-white px-4 py-3 hover:bg-orange-50/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">{day.title}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {day.workoutType.toLowerCase()} · {day.statusLabel}
                    </p>
                  </div>
                  {day.paceDeltaSecPerMile != null ? (
                    <span className="text-xs tabular-nums text-gray-700 shrink-0">
                      {day.paceDeltaSecPerMile > 0
                        ? `${day.paceDeltaSecPerMile}s fast`
                        : day.paceDeltaSecPerMile < 0
                          ? `${Math.abs(day.paceDeltaSecPerMile)}s slow`
                          : "on plan"}
                    </span>
                  ) : null}
                </div>
              </button>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white/80 px-4 py-3">
                <p className="font-medium text-gray-900">{day.title}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {day.workoutType.toLowerCase()} · {day.statusLabel}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
