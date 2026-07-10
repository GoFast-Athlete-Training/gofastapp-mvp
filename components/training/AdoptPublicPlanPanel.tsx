"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

type Props = {
  slug: string;
  planTitle: string;
  presetTitle: string | null;
};

export default function AdoptPublicPlanPanel({ slug, planTitle, presetTitle }: Props) {
  const router = useRouter();
  const [startDate, setStartDate] = useState("");
  const [raceRegistryId, setRaceRegistryId] = useState("");
  const [athleteGoalId, setAthleteGoalId] = useState("");
  const [replaceActivePlan, setReplaceActivePlan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsReplace, setNeedsReplace] = useState(false);

  const handleAdopt = async () => {
    if (!raceRegistryId || !athleteGoalId || !startDate) {
      setError("Pick your race, goal, and start date in Goals first, then enter them here.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/public-training-plans/${encodeURIComponent(slug)}/adopt`, {
        raceRegistryId,
        athleteGoalId,
        startDate,
        replaceActivePlan: replaceActivePlan || needsReplace,
      });
      if (res.data?.trainingPlanId) {
        router.push(`/training-setup/${res.data.trainingPlanId}`);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const msg = e.response?.data?.error || "Could not adopt plan";
      if (msg.includes("active training plan")) {
        setNeedsReplace(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
      <h2 className="text-lg font-bold text-gray-900">Use this plan</h2>
      <p className="mt-2 text-sm text-gray-700">
        Adopt <span className="font-semibold">{planTitle}</span>
        {presetTitle ? (
          <>
            {" "}
            — built on the <span className="font-semibold">{presetTitle}</span> engine. You get your
            own schedule, paces, and race dates.
          </>
        ) : (
          " — you get your own schedule, paces, and race dates."
        )}
      </p>
      <p className="mt-3 text-sm text-gray-600">
        Set up an active goal with a race and goal time first, then enter the IDs below (from Goals)
        or adopt from the app after signing in.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Race registry ID</span>
          <input
            value={raceRegistryId}
            onChange={(e) => setRaceRegistryId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Athlete goal ID</span>
          <input
            value={athleteGoalId}
            onChange={(e) => setAthleteGoalId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Plan start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {needsReplace ? (
          <label className="flex items-center gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={replaceActivePlan}
              onChange={(e) => setReplaceActivePlan(e.target.checked)}
            />
            Replace my current active plan
          </label>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleAdopt()}
          className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? "Building your plan…" : "Use this plan"}
        </button>
        <Link
          href="/goals"
          className="rounded-xl border border-emerald-300 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          Set up goal
        </Link>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <p className="mt-2 text-xs text-gray-500">
        Goal time comes from your active AthleteGoal — no need to enter it here.
      </p>
    </section>
  );
}
