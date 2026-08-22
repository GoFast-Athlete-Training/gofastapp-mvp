"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import api from "@/lib/api";
import { auth } from "@/lib/firebase";
import { formatRaceListDate } from "@/lib/races-display";
import { InlineGoalForm, type InlineGoalRow } from "@/components/races/InlineGoalForm";
import { AddedRacePlanPrompt } from "@/components/training/AddedRacePlanPrompt";
import {
  fetchPlanRaceEvents,
  isAddedRacePromptDismissed,
} from "@/lib/training/added-race-plan-regen";
import { fetchTrainingPlanDetail } from "@/lib/training/fetch-plan-week-client";

type AthleteRaceDetail = {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  city: string | null;
  state: string | null;
  goalTime?: string | null;
  goalName?: string | null;
};

export default function RaceSetupPage({
  params,
}: {
  params: Promise<{ athleteRaceId: string }>;
}) {
  const router = useRouter();
  const { athleteRaceId } = use(params);
  const [athleteRace, setAthleteRace] = useState<AthleteRaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goal, setGoal] = useState<InlineGoalRow | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [terminalRaceName, setTerminalRaceName] = useState<string | null>(null);
  const [snappedAthleteRaceIds, setSnappedAthleteRaceIds] = useState<string[]>([]);
  const [pendingAthleteRaceIds, setPendingAthleteRaceIds] = useState<string[]>([]);
  const [focusWeekNumber, setFocusWeekNumber] = useState<number | null>(null);
  const [weeklyMileageTarget, setWeeklyMileageTarget] = useState(40);
  const [minWeeklyMiles, setMinWeeklyMiles] = useState<number | undefined>(undefined);
  const [showAddedRacePrompt, setShowAddedRacePrompt] = useState(false);
  const [promptHandled, setPromptHandled] = useState(false);

  const load = useCallback(async () => {
    if (!athleteRaceId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ athleteRace?: AthleteRaceDetail; error?: string }>(
        `/athlete-races/${encodeURIComponent(athleteRaceId)}`
      );
      if (data.error || !data.athleteRace) {
        throw new Error(data.error ?? "Race not found");
      }
      const row = data.athleteRace;
      setAthleteRace(row);
      if (row.goalTime?.trim()) {
        setGoal({
          id: row.id,
          goalTime: row.goalTime,
          athleteRaceId: row.id,
        });
        setShowGoalForm(true);
      }

      let user = auth.currentUser;
      if (!user) {
        user = await new Promise<typeof auth.currentUser>((resolve) => {
          const unsub = onAuthStateChanged(auth, (u) => {
            unsub();
            resolve(u);
          });
        });
      }
      if (!user) return;

      const token = await user.getIdToken();

      const listRes = await api.get<{
        athleteRaces?: Array<{ id: string; trainingPlanId?: string | null }>;
      }>("/athlete-races");
      const planId =
        listRes.data.athleteRaces?.find((r) => r.trainingPlanId)?.trainingPlanId ?? null;
      setActivePlanId(planId ?? null);
      if (!planId) return;

      const [raceEvents, planDetail] = await Promise.all([
        fetchPlanRaceEvents(planId, token, { focusAthleteRaceId: athleteRaceId }),
        fetchTrainingPlanDetail(planId, token),
      ]);

      const target =
        (planDetail.plan as { weeklyMileageTarget?: number | null }).weeklyMileageTarget ??
        planDetail.weeklyMileageTargetPreference ??
        40;
      setWeeklyMileageTarget(
        typeof target === "number" && Number.isFinite(target) ? Math.round(target) : 40
      );
      const presetMin = (
        planDetail.plan as {
          training_plan_preset?: { minWeeklyMiles?: number | null } | null;
        }
      ).training_plan_preset?.minWeeklyMiles;
      if (typeof presetMin === "number" && Number.isFinite(presetMin)) {
        setMinWeeklyMiles(Math.round(presetMin));
      }

      if (!raceEvents) return;

      setTerminalRaceName(raceEvents.terminalRace?.name ?? null);
      setSnappedAthleteRaceIds(raceEvents.snappedAthleteRaceIds ?? []);
      const pending = (raceEvents.pendingCandidates ?? []).map((c) => c.athleteRaceId);
      setPendingAthleteRaceIds(pending);
      setFocusWeekNumber(raceEvents.focusWeekNumber ?? null);

      const isPending = pending.includes(athleteRaceId);
      const dismissed = isAddedRacePromptDismissed(athleteRaceId);
      setShowAddedRacePrompt(isPending && !dismissed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load race");
      setAthleteRace(null);
    } finally {
      setLoading(false);
    }
  }, [athleteRaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (error || !athleteRace) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">{error ?? "Race not found"}</p>
        <Link href="/races" className="mt-3 inline-block text-sm font-semibold text-orange-700 hover:underline">
          ← My Races
        </Link>
      </div>
    );
  }

  const location = [athleteRace.city, athleteRace.state].filter(Boolean).join(", ");
  const dateLine = formatRaceListDate(athleteRace.raceDate);

  function addPlanHref() {
    const qs = new URLSearchParams({ athleteRaceId });
    if (activePlanId) qs.set("retireActivePlan", "park");
    return `/training-setup?${qs.toString()}`;
  }

  return (
    <div className="max-w-lg">
      <Link href="/races/find" className="text-sm text-orange-600 font-medium hover:underline">
        ← Find races
      </Link>

      <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-sm font-semibold text-green-900">This race is now in My Races.</p>
        <p className="mt-0.5 text-xs text-green-800">
          GoFast does not register you with the race organizer — use Register on the race page when
          you&apos;re ready for official entry.
        </p>
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-bold text-gray-900">{athleteRace.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {dateLine}
          {location ? ` · ${location}` : ""}
          {athleteRace.distanceLabel ? ` · ${athleteRace.distanceLabel}` : ""}
        </p>
      </div>

      {showAddedRacePrompt && activePlanId && !promptHandled ? (
        <AddedRacePlanPrompt
          className="mt-6"
          planId={activePlanId}
          getToken={async () => {
            const user = auth.currentUser;
            if (!user) throw new Error("Sign in required");
            return user.getIdToken();
          }}
          addedRaceAthleteRaceId={athleteRaceId}
          addedRaceName={athleteRace.name}
          weekNumber={focusWeekNumber}
          terminalRaceName={terminalRaceName}
          weeklyMileageTarget={weeklyMileageTarget}
          minWeeklyMiles={minWeeklyMiles}
          snappedAthleteRaceIds={snappedAthleteRaceIds}
          pendingAthleteRaceIds={pendingAthleteRaceIds}
          onSuccess={() => setPromptHandled(true)}
          onDismiss={() => setShowAddedRacePrompt(false)}
        />
      ) : null}

      {!showGoalForm ? (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-gray-700">What&apos;s next?</p>
          <Link
            href={addPlanHref()}
            className="flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Add a plan
          </Link>
          <button
            type="button"
            onClick={() => setShowGoalForm(true)}
            className="w-full rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900 hover:bg-orange-100"
          >
            Set a goal
          </button>
          <button
            type="button"
            onClick={() => router.push("/races")}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Just running for fun
          </button>
          <p className="text-xs text-gray-500 leading-snug">
            You can add a goal later from My Races whenever you&apos;re ready to train toward a
            finish time.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Set a goal</h2>
          <p className="mt-1 text-xs text-gray-600">
            Optional — skip saves your race without a goal for now.
          </p>
          <InlineGoalForm
            className="mt-4"
            race={{
              athleteRaceId: athleteRace.id,
              name: athleteRace.name,
              raceDate: athleteRace.raceDate,
              distanceLabel: athleteRace.distanceLabel,
              distanceMeters: athleteRace.distanceMeters,
            }}
            goal={goal}
            onSaved={() => {
              router.push(addPlanHref());
            }}
          />
          <button
            type="button"
            onClick={() => router.push("/races")}
            className="mt-4 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Skip for now → My Races
          </button>
        </div>
      )}
    </div>
  );
}
