"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";

type CloseOutPayload = {
  planId: string;
  raceName: string;
  raceDate: string | null;
  raceRegistryId: string | null;
  buildMiles: { loggedWorkouts: number; totalMiles: number };
  result: {
    id: string;
    officialFinishTime: string | null;
    reflection: string | null;
  } | null;
};

type Props = {
  planId: string;
  onArchived?: () => void;
  className?: string;
};

export function RacePlanCloseOutCard({ planId, onArchived, className = "" }: Props) {
  const [data, setData] = useState<CloseOutPayload | null>(null);
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch(
        `/api/training-plan/${encodeURIComponent(planId)}/race-close-out`,
        { headers: athleteBearerFetchHeaders(token) }
      );
      const json = (await res.json()) as CloseOutPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not load close-out");
      setData(json);
      setReflection(json.result?.reflection?.trim() ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load close-out");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch(
        `/api/training-plan/${encodeURIComponent(planId)}/race-close-out`,
        {
          method: "POST",
          headers: {
            ...athleteBearerFetchHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reflection: reflection.trim() || null }),
        }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      onArchived?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className={`text-sm text-gray-500 ${className}`}>Loading race close-out…</p>;
  }

  if (error && !data) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 ${className}`}>
        {error}
      </div>
    );
  }

  if (!data) return null;

  const hasFinish = Boolean(data.result?.officialFinishTime?.trim());

  return (
    <div
      className={`rounded-2xl border-2 border-emerald-200 bg-emerald-50/80 p-6 shadow-sm ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-1">
        Race complete
      </p>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Congrats — you finished!</h2>
      <p className="text-base text-gray-700 mb-4">{data.raceName}</p>

      {hasFinish ? (
        <p className="text-sm font-semibold text-emerald-900 tabular-nums mb-3">
          Finish: {data.result!.officialFinishTime}
        </p>
      ) : (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-950">
            Find your activity to match to this race — your Garmin run should already be in Activity.
          </p>
          <Link
            href="/activities?view=all"
            className="mt-2 inline-flex text-sm font-semibold text-amber-900 hover:underline"
          >
            Open Activity
          </Link>
        </div>
      )}

      <div className="rounded-lg border border-emerald-100 bg-white/80 px-4 py-3 mb-4">
        <p className="text-xs font-semibold uppercase text-gray-500">Your build</p>
        <p className="text-sm text-gray-800 mt-1">
          <span className="font-semibold tabular-nums">{data.buildMiles.totalMiles.toFixed(1)} mi</span>
          {" logged across "}
          <span className="font-semibold tabular-nums">{data.buildMiles.loggedWorkouts}</span>
          {" workouts on this plan."}
        </p>
      </div>

      <label className="block text-sm font-medium text-gray-800 mb-1">Final reflection</label>
      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
        placeholder="How did the build feel? What would you carry into the next race?"
      />

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="inline-flex rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save & close this plan"}
        </button>
        <Link
          href="/races"
          className="inline-flex rounded-xl border-2 border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Find another race
        </Link>
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Ready to start training again? Pick your next race and we&apos;ll start fresh — this plan
        moves to your history.
      </p>
    </div>
  );
}
