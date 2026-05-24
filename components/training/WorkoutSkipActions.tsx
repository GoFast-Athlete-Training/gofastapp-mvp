"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import {
  deriveSessionStatus,
  sessionStatusLabel,
} from "@/lib/training/session-status";

type Props = {
  workoutId: string;
  dateKey: string;
  matchedActivityId?: string | null;
  skippedAt?: string | null;
  workoutType?: string;
  title?: string;
  onUpdated: () => void | Promise<void>;
  /** When true, show a short missed-workout prompt above actions. */
  showMissedPrompt?: boolean;
};

export default function WorkoutSkipActions({
  workoutId,
  dateKey,
  matchedActivityId,
  skippedAt,
  workoutType,
  title,
  onUpdated,
  showMissedPrompt = false,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = deriveSessionStatus({
    dateKey,
    matchedActivityId,
    skippedAt,
    workoutType,
    title,
  });

  if (matchedActivityId || status === "rest" || status === "upcoming" || status === "today") {
    return null;
  }

  async function patchStatus(next: "skipped" | "planned") {
    const u = auth.currentUser;
    if (!u) return;
    setSaving(true);
    setError(null);
    try {
      const token = await u.getIdToken();
      const res = await fetch(`/api/workouts/${encodeURIComponent(workoutId)}/status`, {
        method: "PATCH",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not update status");
      }
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  if (status === "skipped") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-neutral-600">
          You marked this workout as skipped. Match a Garmin run instead, or undo skip.
        </p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void patchStatus("planned")}
          className="inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          {saving ? "Updating…" : "Undo skip"}
        </button>
      </div>
    );
  }

  if (status !== "missed") return null;

  return (
    <div className="space-y-2">
      {showMissedPrompt ? (
        <p className="text-sm text-red-800">
          This looks missed. Match a Garmin run below, or mark it skipped if you intentionally
          passed.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void patchStatus("skipped")}
        className="inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Mark skipped"}
      </button>
      <p className="text-xs text-gray-500">
        Status: {sessionStatusLabel(status)}
      </p>
    </div>
  );
}
