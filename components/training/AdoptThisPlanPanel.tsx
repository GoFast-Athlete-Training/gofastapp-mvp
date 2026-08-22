"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import api from "@/lib/api";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import {
  isLongRaceGoalTimeFormat,
  parseGoalTimeToParts,
  validateAndAssembleGoalTime,
} from "@/lib/goal-time-input";

type AthleteRaceRow = {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  goalTime: string | null;
};

export type AdoptThisPlanPanelProps = {
  slug: string;
  planTitle: string;
  raceRegistryId: string;
  raceName: string;
  raceDate: string;
  distanceLabel?: string | null;
  distanceMeters?: number | null;
  /** Hide adopt when viewer is the plan author */
  sourceAuthorAthleteId?: string | null;
  className?: string;
};

function parseFiveKPaceToParts(pace: string | null | undefined): { min: string; sec: string } {
  const t = (pace ?? "").trim();
  const m = /^(\d+):(\d{1,2})$/.exec(t);
  if (m) {
    const secNum = Math.min(59, Math.max(0, parseInt(m[2], 10)));
    return { min: m[1], sec: String(secNum).padStart(2, "0") };
  }
  return { min: "", sec: "" };
}

function buildFiveKPaceFromParts(minStr: string, secStr: string): string | null {
  const min = Number(minStr);
  const sec = Number(secStr);
  if (!Number.isFinite(min) || !Number.isFinite(sec)) return null;
  if (min < 2 || min > 30 || sec < 0 || sec > 59) return null;
  return `${Math.round(min)}:${String(Math.round(sec)).padStart(2, "0")}`;
}

function formatRaceWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

export default function AdoptThisPlanPanel({
  slug,
  planTitle,
  raceRegistryId,
  raceName,
  raceDate,
  distanceLabel,
  distanceMeters,
  sourceAuthorAthleteId,
  className = "",
}: AdoptThisPlanPanelProps) {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [viewerAthleteId, setViewerAthleteId] = useState<string | null>(null);
  const [races, setRaces] = useState<AthleteRaceRow[]>([]);
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [paceMin, setPaceMin] = useState("");
  const [paceSec, setPaceSec] = useState("");
  const [weeklyMileage, setWeeklyMileage] = useState("");
  const [replaceActivePlan, setReplaceActivePlan] = useState(false);
  const [needsReplace, setNeedsReplace] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLongGoal = isLongRaceGoalTimeFormat(distanceLabel ?? null, distanceMeters ?? null);
  const matchedRace = useMemo(
    () => races.find((r) => r.raceRegistryId === raceRegistryId) ?? null,
    [races, raceRegistryId]
  );

  const goalParts = parseGoalTimeToParts(matchedRace?.goalTime);
  const [goalH, setGoalH] = useState(goalParts.h);
  const [goalM, setGoalM] = useState(goalParts.m);
  const [goalS, setGoalS] = useState(goalParts.s);

  useEffect(() => {
    const p = parseGoalTimeToParts(matchedRace?.goalTime);
    setGoalH(p.h);
    setGoalM(p.m);
    setGoalS(p.s);
  }, [matchedRace?.id, matchedRace?.goalTime]);

  const loadRaces = useCallback(async () => {
    setLoadingRaces(true);
    setError(null);
    try {
      setViewerAthleteId(LocalStorageAPI.getAthleteId());
      const racesRes = await api.get("/athlete-races");
      const rows = (racesRes.data?.athleteRaces ?? racesRes.data?.signups ?? []) as AthleteRaceRow[];
      setRaces(rows);
      const hydrateRes = await api.get("/training/hydrate").catch(() => null);
      const current5k = hydrateRes?.data?.snapshot?.current5k as string | null | undefined;
      if (current5k?.trim()) {
        const paceParts = parseFiveKPaceToParts(current5k);
        setPaceMin(paceParts.min);
        setPaceSec(paceParts.sec);
      }
    } catch {
      setError("Could not load your races.");
    } finally {
      setLoadingRaces(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      setSignedIn(!!user);
      if (user) void loadRaces();
    });
    return () => unsub();
  }, [loadRaces]);

  if (sourceAuthorAthleteId && viewerAthleteId && sourceAuthorAthleteId === viewerAthleteId) {
    return null;
  }

  if (!authReady) {
    return null;
  }

  if (!signedIn) {
    return (
      <section
        className={`rounded-2xl border border-violet-200 bg-violet-50/60 p-6 ${className}`}
      >
        <h2 className="text-lg font-bold text-gray-900">Adopt this plan</h2>
        <p className="mt-2 text-sm text-gray-700">
          Same race, same build — sign in to copy <span className="font-semibold">{planTitle}</span>{" "}
          with your goal time and fitness.
        </p>
        <Link
          href="/welcome"
          className="mt-4 inline-flex rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
        >
          Sign in to adopt
        </Link>
      </section>
    );
  }

  async function handleClaimRace() {
    setClaiming(true);
    setError(null);
    try {
      await api.post("/athlete-races", { raceRegistryId });
      await loadRaces();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error ?? "Could not add this race");
    } finally {
      setClaiming(false);
    }
  }

  async function handleAdopt() {
    if (!matchedRace) {
      setError("Add this race to My Races first.");
      return;
    }
    if (!startDate) {
      setError("Pick a plan start date.");
      return;
    }

    const goalResult = validateAndAssembleGoalTime(
      { distanceLabel: distanceLabel ?? null, distanceMeters: distanceMeters ?? null },
      goalH,
      goalM,
      goalS
    );
    if (!goalResult.ok) {
      setError(goalResult.message);
      return;
    }
    const goalTime = goalResult.goalTime;
    if (!goalTime) {
      setError("Enter your goal time for this race.");
      return;
    }

    const paceEmpty = paceMin.trim() === "" && paceSec.trim() === "";
    const fiveKPace = paceEmpty ? null : buildFiveKPaceFromParts(paceMin.trim(), paceSec.trim());
    if (!paceEmpty && !fiveKPace) {
      setError("Enter a valid 5K pace (minutes and seconds 0–59).");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/public-training-plans/${encodeURIComponent(slug)}/adopt`, {
        athleteRaceId: matchedRace.id,
        startDate,
        goalTime,
        fiveKPace,
        weeklyMileage: weeklyMileage.trim() === "" ? null : Number(weeklyMileage),
        replaceActivePlan: replaceActivePlan || needsReplace,
      });
      if (res.data?.trainingPlanId) {
        router.push("/training");
        return;
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string }; status?: number } };
      const msg = e.response?.data?.error ?? "Could not adopt plan";
      if (e.response?.status === 409 || msg.includes("active training plan")) {
        setNeedsReplace(true);
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const raceLine = [
    raceName,
    formatRaceWhen(raceDate),
    distanceLabel?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className={`rounded-2xl border border-violet-200 bg-violet-50/60 p-6 ${className}`}
    >
      <h2 className="text-lg font-bold text-gray-900">Adopt this plan</h2>
      <p className="mt-2 text-sm text-gray-700">
        Same race, same build — your goal time and fitness shape the paces for{" "}
        <span className="font-semibold">{planTitle}</span>.
      </p>

      <div className="mt-4 rounded-xl border border-violet-100 bg-white/80 px-4 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Race</p>
        <p className="mt-1 font-medium text-gray-900">{raceLine}</p>
        <p className="mt-1 text-xs text-gray-500">
          You must be training for this race to adopt — leader&apos;s goal is not copied.
        </p>
      </div>

      {loadingRaces ? (
        <p className="mt-4 text-sm text-gray-500">Loading your races…</p>
      ) : !matchedRace ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-700">
            Add <span className="font-semibold">{raceName}</span> to My Races to adopt this plan.
          </p>
          <button
            type="button"
            disabled={claiming}
            onClick={() => void handleClaimRace()}
            className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {claiming ? "Adding race…" : `Add ${raceName} to My Races`}
          </button>
          <p className="text-xs text-gray-500">
            Or manage races in{" "}
            <Link href="/races" className="text-violet-700 font-semibold hover:underline">
              My Races
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Your goal time</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isLongGoal ? (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={goalH}
                    onChange={(e) => setGoalH(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    placeholder="H"
                    className="w-14 rounded-lg border border-gray-300 px-2 py-2 text-sm text-center"
                    aria-label="Goal hours"
                  />
                  <span className="text-gray-400">:</span>
                </>
              ) : null}
              <input
                type="text"
                inputMode="numeric"
                value={goalM}
                onChange={(e) => setGoalM(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="MM"
                className="w-14 rounded-lg border border-gray-300 px-2 py-2 text-sm text-center"
                aria-label="Goal minutes"
              />
              <span className="text-gray-400">:</span>
              <input
                type="text"
                inputMode="numeric"
                value={goalS}
                onChange={(e) => setGoalS(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="SS"
                className="w-14 rounded-lg border border-gray-300 px-2 py-2 text-sm text-center"
                aria-label="Goal seconds"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Current 5K pace</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={paceMin}
                  onChange={(e) => setPaceMin(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="min"
                  className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
                <span className="text-gray-400">:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paceSec}
                  onChange={(e) => setPaceSec(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="sec"
                  className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm"
                />
                <span className="text-xs text-gray-500">/mi pace proxy</span>
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Weekly mileage</span>
              <input
                type="number"
                min={1}
                step={1}
                value={weeklyMileage}
                onChange={(e) => setWeeklyMileage(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

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
              Park my current active plan and adopt this one
            </label>
          ) : null}

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleAdopt()}
            className="rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {submitting ? "Building your plan…" : "Adopt this plan"}
          </button>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
