"use client";

import { useState } from "react";
import api from "@/lib/api";
import type { WhereYouStandSnapshot } from "@/lib/training/where-you-stand";

function parsePaceInputToSec(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length !== 2) return null;
  const sec = Math.round(Number(parts[0]) * 60 + Number(parts[1]));
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return sec;
}

function PaceAnchorField({
  label,
  current,
  proposed,
  reason,
  sourceTitle,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  current: string | null;
  proposed: string | null;
  reason: string | null;
  sourceTitle: string | null;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const hasProposal = proposed != null && proposed !== current;
  return (
    <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-600">
        Saved anchor:{" "}
        <span className="font-semibold tabular-nums text-gray-900">{current ?? "Not set"}</span>
      </p>
      {hasProposal ? (
        <>
          <p className="mt-1 text-sm text-emerald-800">
            Suggested from this week:{" "}
            <span className="font-semibold tabular-nums">{proposed}</span>
            {sourceTitle ? ` (${sourceTitle})` : ""}
          </p>
          {reason ? <p className="mt-1 text-xs text-gray-500">{reason}</p> : null}
        </>
      ) : null}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "7:30"}
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
  const [durabilityPace, setDurabilityPace] = useState(
    stand.durability.proposedPace ?? stand.durability.currentPace ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      const fiveKSec = parsePaceInputToSec(fiveK);
      if (fiveKSec != null) body.fiveKPaceSecPerMile = fiveKSec;
      const thresholdSec = parsePaceInputToSec(threshold);
      if (thresholdSec != null) body.thresholdPaceSecPerMile = thresholdSec;
      if (durabilityMiles.trim()) {
        const miles = Number(durabilityMiles);
        if (Number.isFinite(miles) && miles > 0) {
          body.longRunCapabilityMiles = miles;
          const paceSec = parsePaceInputToSec(durabilityPace);
          if (paceSec != null) {
            body.longRunCapabilityPaceSecPerMile = paceSec;
          } else if (stand.durability.proposedPaceSecPerMile != null) {
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

  const predictedHasProposal =
    stand.predicted?.proposedFinish != null &&
    stand.predicted.proposedFinish !== stand.predicted.currentFinish;

  return (
    <section className="rounded-xl border border-emerald-100 bg-emerald-50/40 px-5 py-4 mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-1">
        Where you stand
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        These are the paces and long-run numbers saved on your profile. Edit them if you want
        something different — we only suggest a change when a quality workout this week beat the
        plan.
      </p>
      <div className="space-y-3">
        <PaceAnchorField
          label="5K pace"
          current={stand.fiveK.currentPace}
          proposed={stand.fiveK.proposedPace}
          reason={stand.fiveK.reason}
          sourceTitle={stand.fiveK.sourceTitle}
          value={fiveK}
          onChange={setFiveK}
          placeholder="6:22"
        />
        <PaceAnchorField
          label="Threshold pace"
          current={stand.threshold.currentPace}
          proposed={stand.threshold.proposedPace}
          reason={stand.threshold.reason}
          sourceTitle={stand.threshold.sourceTitle}
          value={threshold}
          onChange={setThreshold}
          placeholder="6:00"
        />
        <div className="rounded-lg border border-emerald-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Long-run durability
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Saved anchor:{" "}
            <span className="font-semibold tabular-nums text-gray-900">
              {stand.durability.currentMiles != null
                ? `${stand.durability.currentMiles.toFixed(1)} mi`
                : "Not set"}
              {stand.durability.currentPace ? ` @ ${stand.durability.currentPace}` : ""}
            </span>
          </p>
          {stand.durability.proposedMiles != null &&
          stand.durability.proposedMiles !== stand.durability.currentMiles ? (
            <>
              <p className="mt-1 text-sm text-emerald-800">
                Suggested from this week:{" "}
                <span className="font-semibold tabular-nums">
                  {stand.durability.proposedMiles.toFixed(1)} mi
                </span>
                {stand.durability.proposedPace ? ` @ ${stand.durability.proposedPace}` : ""}
                {stand.durability.sourceTitle ? ` (${stand.durability.sourceTitle})` : ""}
              </p>
              {stand.durability.reason ? (
                <p className="mt-1 text-xs text-gray-500">{stand.durability.reason}</p>
              ) : null}
            </>
          ) : null}
          <label className="mt-2 block text-xs font-medium text-gray-500">Longest run (mi)</label>
          <input
            type="text"
            value={durabilityMiles}
            onChange={(e) => setDurabilityMiles(e.target.value)}
            placeholder="16.0"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums"
          />
          <label className="mt-2 block text-xs font-medium text-gray-500">Pace at that run</label>
          <input
            type="text"
            value={durabilityPace}
            onChange={(e) => setDurabilityPace(e.target.value)}
            placeholder="7:52"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums"
          />
        </div>
        {stand.predicted?.currentFinish ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
              Predicted finish
              {stand.predicted.goalRaceName ? ` · ${stand.predicted.goalRaceName}` : ""}
            </p>
            <p className="mt-1 text-xs text-violet-900/80">
              Estimated from your saved 5K pace and long-run durability — not a race result.
            </p>
            <p className="mt-2 text-sm text-gray-700">
              With current anchors:{" "}
              <span className="font-semibold tabular-nums">{stand.predicted.currentFinish}</span>
            </p>
            {predictedHasProposal ? (
              <p className="mt-1 text-sm text-violet-900">
                If you confirm suggested paces above:{" "}
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
        {busy ? "Saving…" : "Save anchors"}
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
            ) : day.workoutId ? (
              <button
                type="button"
                onClick={() => onOpenWorkout(day.workoutId!)}
                className="w-full text-left rounded-lg border border-gray-200 bg-white/80 px-4 py-3 hover:bg-gray-50"
              >
                <p className="font-medium text-gray-900">{day.title}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {day.workoutType.toLowerCase()} · {day.statusLabel}
                </p>
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
