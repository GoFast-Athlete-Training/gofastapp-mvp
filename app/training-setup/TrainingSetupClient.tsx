"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { raceCalendarBeforeTodayUtc } from "@/lib/training/plan-utils";
import {
  presetMatchesDistance,
  snapDistanceLabelFromMeters,
} from "@/lib/training/preset-distance-match";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import { AthletePresetBuilder } from "@/components/training/AthletePresetBuilder";
import { InlineGoalForm, type InlineGoalRow } from "@/components/races/InlineGoalForm";
import { fetchTrainingPlanDetail } from "@/lib/training/fetch-plan-week-client";

type RaceRegistryLite = {
  id: string;
  name: string;
  raceDate: string;
  distanceMeters?: number | null;
  distanceLabel?: string | null;
  city?: string | null;
  state?: string | null;
};

type GoalAthleteRaceLite = {
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceMeters?: number | null;
  distanceLabel?: string | null;
  city?: string | null;
  state?: string | null;
};

type GoalRow = {
  id: string;
  status: string;
  goalTime: string | null;
  athleteRaceId: string | null;
  targetByDate: string;
  name?: string | null;
  athlete_race: GoalAthleteRaceLite | null;
};

type SignupRow = {
  id: string;
  raceRegistryId: string;
  race_registry: RaceRegistryLite | null;
};

function goalTimeReady(g: GoalRow): boolean {
  return typeof g.goalTime === "string" && g.goalTime.trim().length > 0;
}

function goalRaceReady(g: GoalRow): boolean {
  return !!g.athlete_race?.raceRegistryId;
}

function isQualifyingGoal(g: GoalRow): boolean {
  if (g.status !== "ACTIVE" || !goalRaceReady(g) || !goalTimeReady(g)) return false;
  const rd = g.athlete_race?.raceDate;
  if (!rd || raceCalendarBeforeTodayUtc(rd)) return false;
  return true;
}

type ActivePlanLite = {
  id: string;
  name: string;
  athleteRaceId: string | null;
  lifecycleStatus: string;
  planSchedule: unknown;
  _count?: { planned_workouts: number };
  race_registry: { name: string } | null;
};

type PresetForWizard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publicDescription: string | null;
  targetDistanceLabel: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  baseLongRunPoolMiles: number;
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

/** Shown after race date on plan setup (never empty parens — old UI used missing `raceType`). */
function raceDistanceDisplayForGoal(rr: RaceRegistryLite): string | null {
  const dl = rr.distanceLabel?.trim();
  if (dl) return dl;
  const snapped = snapDistanceLabelFromMeters(rr.distanceMeters);
  if (snapped) return snapped;
  const dm = rr.distanceMeters;
  if (dm != null && Number.isFinite(Number(dm))) {
    return `${Math.round(Number(dm))} m`;
  }
  return null;
}

/** Map API failures to safe UX (avoid surfacing raw 400 strings). */
function planCreateFeedbackKind(
  status: number,
  message?: string
): "goals" | "dates" | "preset" | "generic" {
  const m = (message ?? "").toLowerCase();
  if (status === 422) {
    if (m.includes("preset")) return "preset";
    return "generic";
  }
  if (status === 400) {
    if (m.includes("before race") || m.includes("invalid startdate")) {
      return "dates";
    }
    return "goals";
  }
  if (status === 404) {
    return "goals";
  }
  return "generic";
}

function suggestPlanName(raceName: string, firstName: string | null): string {
  const race = raceName.trim();
  if (!race) return "My Training Plan";
  if (firstName?.trim()) return `${firstName.trim()}'s ${race} Build`;
  return `${race} Build`;
}

function signupToGoalRow(s: SignupRow): GoalRow | null {
  const rr = s.race_registry;
  if (!rr?.raceDate || raceCalendarBeforeTodayUtc(rr.raceDate)) return null;
  return {
    id: s.id,
    status: "ACTIVE",
    goalTime: null,
    athleteRaceId: s.id,
    targetByDate: rr.raceDate,
    athlete_race: {
      raceRegistryId: s.raceRegistryId,
      name: rr.name,
      raceDate: rr.raceDate,
      distanceMeters: rr.distanceMeters ?? null,
      distanceLabel: rr.distanceLabel ?? null,
      city: rr.city ?? null,
      state: rr.state ?? null,
    },
  };
}

function athleteRaceApiToGoalRow(row: {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceMeters?: number | null;
  distanceLabel?: string | null;
  city?: string | null;
  state?: string | null;
  goalTime?: string | null;
}): GoalRow | null {
  if (raceCalendarBeforeTodayUtc(row.raceDate)) return null;
  return {
    id: row.id,
    status: "ACTIVE",
    goalTime: row.goalTime?.trim() || null,
    athleteRaceId: row.id,
    targetByDate: row.raceDate,
    athlete_race: {
      raceRegistryId: row.raceRegistryId,
      name: row.name,
      raceDate: row.raceDate,
      distanceMeters: row.distanceMeters ?? null,
      distanceLabel: row.distanceLabel ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
    },
  };
}

export default function TrainingSetupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const athleteRaceIdFromUrl =
    searchParams.get("athleteRaceId")?.trim() ||
    searchParams.get("goalId")?.trim() ||
    "";
  const retireActivePlanFromUrl =
    searchParams.get("retireActivePlan") === "archive" ? "archive" : "park";
  const replacingFromAddedRace = searchParams.has("retireActivePlan");

  const [ready, setReady] = useState(false);
  const [loadingOrientation, setLoadingOrientation] = useState(true);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [signups, setSignups] = useState<SignupRow[]>([]);
  const [orientationError, setOrientationError] = useState<string | null>(null);

  const [wizardGoal, setWizardGoal] = useState<GoalRow | null>(null);
  const [startDate, setStartDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createFeedback, setCreateFeedback] = useState<
    "goals" | "dates" | "preset" | "generic" | null
  >(null);
  const [paceMin, setPaceMin] = useState("");
  const [paceSec, setPaceSec] = useState("");
  const [baselineWeeklyMileage, setBaselineWeeklyMileage] = useState("");
  const [planName, setPlanName] = useState("");
  const [planNameTouched, setPlanNameTouched] = useState(false);
  const [athleteFirstName, setAthleteFirstName] = useState<string | null>(null);
  const [activePlans, setActivePlans] = useState<ActivePlanLite[]>([]);
  const [replaceGoalAcknowledged, setReplaceGoalAcknowledged] = useState(false);
  const [replaceBlockPlan, setReplaceBlockPlan] = useState<ActivePlanLite | null>(null);

  /** Presets from prod API; athlete picks one before baseline step. */
  const [prodPresets, setProdPresets] = useState<PresetForWizard[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetForWizard | null>(null);
  const [presetPickMode, setPresetPickMode] = useState<"choose" | "catalog" | "custom">("choose");
  const [selectedAthletePresetId, setSelectedAthletePresetId] = useState<string | null>(null);
  const [savedAthletePresets, setSavedAthletePresets] = useState<
    {
      id: string;
      title: string;
      isComplete: boolean;
      buildStep: string;
      buildStepLabel: string;
      updatedAt: string;
    }[]
  >([]);
  const [loadingAthletePresets, setLoadingAthletePresets] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  /** undefined = preset list; null = new builder; string = resume id */
  const [customBuilderPresetId, setCustomBuilderPresetId] = useState<string | null | undefined>(
    undefined
  );
  /** When switching to a different race: null = show fork, same-shape | create-own */
  const [changeRaceForkChoice, setChangeRaceForkChoice] = useState<
    null | "same-shape" | "create-own"
  >(null);
  const [loadingSameShape, setLoadingSameShape] = useState(false);

  const qualifyingGoals = useMemo(() => goals.filter(isQualifyingGoal), [goals]);

  const activePlanForOtherRace = useMemo(() => {
    if (!wizardGoal) return null;
    const wizardRaceId = wizardGoal.athleteRaceId ?? wizardGoal.id;
    const active = activePlans.find((p) => p.lifecycleStatus === "ACTIVE");
    if (!active?.athleteRaceId || active.athleteRaceId === wizardRaceId) return null;
    return active;
  }, [activePlans, wizardGoal]);

  /** Presets compatible with the current wizard goal race distance (or all if distance unknown). */
  const presetsForWizardGoal = useMemo(() => {
    const dm = wizardGoal?.athlete_race?.distanceMeters;
    if (dm == null || !Number.isFinite(Number(dm))) {
      return prodPresets;
    }
    return prodPresets.filter((p) => presetMatchesDistance(p.targetDistanceLabel, Number(dm)));
  }, [prodPresets, wizardGoal?.athlete_race?.distanceMeters, wizardGoal?.id]);

  const futureSignups = useMemo(
    () =>
      signups.filter(
        (s) =>
          !!s.race_registry?.raceDate &&
          !raceCalendarBeforeTodayUtc(s.race_registry.raceDate)
      ),
    [signups]
  );

  const pastRaceGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          g.status === "ACTIVE" &&
          goalRaceReady(g) &&
          goalTimeReady(g) &&
          !!g.athlete_race?.raceDate &&
          raceCalendarBeforeTodayUtc(g.athlete_race.raceDate)
      ),
    [goals]
  );

  const incompleteRaceNeedsTime = useMemo(
    () =>
      goals.some(
        (g) => g.status === "ACTIVE" && goalRaceReady(g) && !goalTimeReady(g)
      ),
    [goals]
  );

  const activeNeedsRace = useMemo(
    () => goals.some((g) => g.status === "ACTIVE" && !goalRaceReady(g)),
    [goals]
  );

  async function getToken() {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in required");
    return u.getIdToken();
  }

  const loadOrientation = useCallback(async () => {
    setLoadingOrientation(true);
    setOrientationError(null);
    try {
      const token = await getToken();
      const headers = athleteBearerFetchHeaders(token);
      const [gRes, sRes, pRes, presetRes] = await Promise.all([
        fetch("/api/goals?status=ACTIVE", { headers }),
        fetch("/api/race-signups", { headers }),
        fetch("/api/training-plan?status=active", { headers }),
        fetch("/api/training/plan-preset/prod", { headers }),
      ]);
      const gJson = await gRes.json();
      const sJson = await sRes.json();
      const pJson = await pRes.json();
      let presetsParsed: PresetForWizard[] = [];
      if (presetRes.ok) {
        try {
          const pr = await presetRes.json();
          if (pr?.success === true && Array.isArray(pr.presets)) {
            presetsParsed = (pr.presets as unknown[])
              .map((row): PresetForWizard | null => {
                if (!row || typeof row !== "object") return null;
                const r = row as Record<string, unknown>;
                const id = typeof r.id === "string" ? r.id.trim() : "";
                if (!id) return null;
                const slug = typeof r.slug === "string" ? r.slug.trim() : "";
                const title =
                  typeof r.title === "string" && r.title.trim().length > 0
                    ? r.title.trim()
                    : "Training preset";
                const description =
                  typeof r.description === "string" && r.description.trim().length > 0
                    ? r.description.trim()
                    : null;
                const publicDescription =
                  typeof r.publicDescription === "string" && r.publicDescription.trim().length > 0
                    ? r.publicDescription.trim()
                    : null;
                const targetDistanceLabel =
                  typeof r.targetDistanceLabel === "string" && r.targetDistanceLabel.trim().length > 0
                    ? r.targetDistanceLabel.trim()
                    : null;
                const minWeeklyMilesRaw = Number(r.minWeeklyMiles);
                const maxRaw = r.maxWeeklyMiles;
                const baseRaw = Number(r.baseLongRunPoolMiles);
                let minWeeklyMiles = 40;
                let maxWeeklyMiles: number | null = null;
                let baseLongRunPoolMiles = 40;
                if (Number.isFinite(minWeeklyMilesRaw) && minWeeklyMilesRaw >= 1) {
                  minWeeklyMiles = Math.round(minWeeklyMilesRaw);
                }
                if (maxRaw != null && Number.isFinite(Number(maxRaw)) && Number(maxRaw) >= minWeeklyMiles) {
                  maxWeeklyMiles = Math.round(Number(maxRaw));
                }
                if (Number.isFinite(baseRaw) && baseRaw > 0) baseLongRunPoolMiles = baseRaw;
                return {
                  id,
                  slug,
                  title,
                  description,
                  publicDescription,
                  targetDistanceLabel,
                  minWeeklyMiles,
                  maxWeeklyMiles,
                  baseLongRunPoolMiles,
                };
              })
              .filter((x): x is PresetForWizard => x != null);
          }
        } catch {
          presetsParsed = [];
        }
      }
      setProdPresets(presetsParsed);
      if (pRes.ok && Array.isArray(pJson.plans)) {
        setActivePlans(pJson.plans as ActivePlanLite[]);
      } else {
        setActivePlans([]);
      }
      if (!gRes.ok) {
        setOrientationError(gJson.error || "Failed to load goals");
        setGoals([]);
      } else {
        setGoals(gJson.goals ?? []);
      }
      if (!sRes.ok) {
        setSignups([]);
      } else {
        setSignups(sJson.signups ?? []);
      }
    } catch (e) {
      setOrientationError(e instanceof Error ? e.message : "Load failed");
      setGoals([]);
      setSignups([]);
      setActivePlans([]);
      setProdPresets([]);
    } finally {
      setLoadingOrientation(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setReady(true);
      } else {
        setReady(false);
        router.replace("/welcome");
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    loadOrientation();
  }, [ready, loadOrientation]);

  useEffect(() => {
    if (!ready || loadingOrientation || !athleteRaceIdFromUrl || wizardGoal) return;

    const fromGoals = goals.find(
      (g) => g.id === athleteRaceIdFromUrl || g.athleteRaceId === athleteRaceIdFromUrl
    );
    if (fromGoals && goalRaceReady(fromGoals) && !raceCalendarBeforeTodayUtc(fromGoals.athlete_race!.raceDate)) {
      setWizardGoal(fromGoals);
      return;
    }

    const fromSignup = signups
      .map(signupToGoalRow)
      .find((g) => g?.id === athleteRaceIdFromUrl);
    if (fromSignup) {
      setWizardGoal(fromSignup);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/athlete-races/${encodeURIComponent(athleteRaceIdFromUrl)}`, {
          headers: athleteBearerFetchHeaders(token),
        });
        const data = (await res.json()) as { athleteRace?: Parameters<typeof athleteRaceApiToGoalRow>[0] };
        if (cancelled || !res.ok || !data.athleteRace) return;
        const row = athleteRaceApiToGoalRow(data.athleteRace);
        if (row) setWizardGoal(row);
      } catch {
        /* optional fetch */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, loadingOrientation, athleteRaceIdFromUrl, goals, signups, wizardGoal]);

  useEffect(() => {
    if (!ready || !wizardGoal || loadingOrientation) return;
    const id = LocalStorageAPI.getAthleteId();
    if (!id) return;
    let cancelled = false;
    api
      .get<{
        athlete?: {
          firstName?: string | null;
          fiveKPace?: string | null;
          weeklyMileage?: number | null;
        };
      }>(`/athlete/${id}`)
      .then((res) => {
        if (cancelled) return;
        const a = res.data?.athlete;
        if (!a) return;
        if (typeof a.firstName === "string" && a.firstName.trim()) {
          setAthleteFirstName(a.firstName.trim());
        } else {
          setAthleteFirstName(null);
        }
        const parts = parseFiveKPaceToParts(a.fiveKPace);
        setPaceMin(parts.min);
        setPaceSec(parts.sec);
        setBaselineWeeklyMileage((prev) => {
          if (prev.trim() !== "") return prev;
          if (a.weeklyMileage != null && Number.isFinite(Number(a.weeklyMileage))) {
            return String(a.weeklyMileage);
          }
          return "";
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, wizardGoal, loadingOrientation]);

  useEffect(() => {
    setCreateFeedback((prev) => (prev === "dates" ? null : prev));
  }, [startDate]);

  useEffect(() => {
    if (planNameTouched || !wizardGoal?.athlete_race?.name) return;
    setPlanName(suggestPlanName(wizardGoal.athlete_race.name, athleteFirstName));
  }, [wizardGoal?.id, wizardGoal?.athlete_race?.name, athleteFirstName, planNameTouched]);

  const loadAthletePresets = useCallback(async () => {
    setLoadingAthletePresets(true);
    try {
      const u = auth.currentUser;
      if (!u) return;
      const token = await u.getIdToken();
      const res = await fetch("/api/athlete-presets", {
        headers: athleteBearerFetchHeaders(token),
      });
      const data = (await res.json()) as {
        athletePresets?: {
          id: string;
          title: string;
          isComplete: boolean;
          buildStep: string;
          buildStepLabel: string;
          updatedAt: string;
        }[];
      };
      if (res.ok && data.athletePresets) {
        setSavedAthletePresets(data.athletePresets);
      }
    } catch {
      /* list optional */
    } finally {
      setLoadingAthletePresets(false);
    }
  }, []);

  useEffect(() => {
    if (presetPickMode !== "custom") {
      setCustomBuilderPresetId(undefined);
      return;
    }
    void loadAthletePresets();
  }, [presetPickMode, loadAthletePresets, customBuilderPresetId]);

  function beginWizardForGoal(g: GoalRow) {
    setWizardGoal(g);
    setSelectedPreset(null);
    setSelectedAthletePresetId(null);
    setPresetPickMode("choose");
    setCustomBuilderPresetId(undefined);
    setPlanName("");
    setPlanNameTouched(false);
    setFormError(null);
    setCreateFeedback(null);
    setReplaceGoalAcknowledged(false);
    setReplaceBlockPlan(null);
    setChangeRaceForkChoice(null);
    const today = new Date();
    setStartDate(today.toISOString().split("T")[0]);
    const qs = new URLSearchParams({ athleteRaceId: g.id });
    if (replacingFromAddedRace) qs.set("retireActivePlan", retireActivePlanFromUrl);
    router.replace(`/training-setup?${qs.toString()}`, { scroll: false });
  }

  function handleInitiateGoalSaved(updated: InlineGoalRow) {
    if (!wizardGoal) return;
    const gt = updated.goalTime?.trim() || null;
    setWizardGoal((prev) => (prev ? { ...prev, goalTime: gt } : prev));
    setGoals((prev) => {
      const idx = prev.findIndex((g) => g.id === wizardGoal.id);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx]!, goalTime: gt };
      return next;
    });
    void loadOrientation();
  }

  function exitWizard() {
    setWizardGoal(null);
    setSelectedPreset(null);
    setSelectedAthletePresetId(null);
    setPresetPickMode("choose");
    setFormError(null);
    setCreateFeedback(null);
    setReplaceGoalAcknowledged(false);
    setReplaceBlockPlan(null);
    setChangeRaceForkChoice(null);
    router.replace("/training-setup", { scroll: false });
  }

  async function refreshGoalsAndExitWizard() {
    setCreateFeedback(null);
    await loadOrientation();
    exitWizard();
  }

  async function createPlan(opts?: { forceReplace?: boolean }) {
    if (!wizardGoal?.athlete_race?.raceRegistryId) {
      setFormError(null);
      setCreateFeedback("goals");
      return;
    }
    if (!startDate) {
      setFormError("Pick a start date for your plan.");
      return;
    }

    const conflicting = activePlans.find(
      (p) => p.lifecycleStatus === "ACTIVE" && p.athleteRaceId === wizardGoal.athleteRaceId
    );
    const mayReplace = replaceGoalAcknowledged || opts?.forceReplace === true;
    if (conflicting && !mayReplace) {
      setReplaceBlockPlan(conflicting);
      setFormError(null);
      setCreateFeedback(null);
      return;
    }
    setReplaceBlockPlan(null);
    if (opts?.forceReplace) setReplaceGoalAcknowledged(true);

    if (!selectedPreset?.id && !selectedAthletePresetId) {
      setCreateFeedback("preset");
      return;
    }

    const trimmedPlanName = planName.trim();
    if (!trimmedPlanName) {
      setFormError("Give your plan a name — you'll use it when sharing publicly.");
      return;
    }

    const rawMw = baselineWeeklyMileage.trim();
    if (rawMw !== "") {
      const weeklyMi = Number(rawMw);
      if (!Number.isFinite(weeklyMi) || weeklyMi <= 0) {
        setFormError("Enter your current weekly miles as a positive number, or leave it blank.");
        return;
      }
    }

    const paceEmpty = paceMin.trim() === "" && paceSec.trim() === "";
    const fiveKPaceOut = paceEmpty
      ? null
      : buildFiveKPaceFromParts(paceMin.trim(), paceSec.trim());
    if (!paceEmpty && fiveKPaceOut == null) {
      setFormError("Enter a valid 5K pace (minutes and seconds 0–59).");
      return;
    }

    setCreating(true);
    setFormError(null);
    setCreateFeedback(null);
    try {
      const token = await getToken();
      const hasOtherActivePlan = activePlans.some((p) => p.lifecycleStatus === "ACTIVE");
      const res = await fetch("/api/training-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          athleteRaceId: wizardGoal.athleteRaceId ?? wizardGoal.id,
          raceRegistryId: wizardGoal.athlete_race.raceRegistryId,
          name: trimmedPlanName,
          startDate: new Date(startDate).toISOString(),
          fiveKPace: fiveKPaceOut,
          currentWeeklyMileage:
            baselineWeeklyMileage.trim() === ""
              ? null
              : Number(baselineWeeklyMileage),
          syncAthleteBaseline: true,
          ...(selectedAthletePresetId
            ? { athletePresetId: selectedAthletePresetId }
            : { presetId: selectedPreset!.id }),
          ...(hasOtherActivePlan || replacingFromAddedRace
            ? {
                replaceActivePlan: true,
                retireActivePlan: replacingFromAddedRace
                  ? retireActivePlanFromUrl
                  : "park",
              }
            : {}),
        }),
      });
      let data: { error?: string; plan?: { id: string } } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setCreateFeedback(planCreateFeedbackKind(res.status, data.error));
        return;
      }
      if (data.plan?.id) {
        setReplaceGoalAcknowledged(false);
        router.push(`/training-setup/${data.plan.id}`);
      } else {
        setCreateFeedback("generic");
      }
    } catch {
      setCreateFeedback("generic");
    } finally {
      setCreating(false);
    }
  }

  function scheduleReady(p: ActivePlanLite): boolean {
    return (
      p.planSchedule != null &&
      Array.isArray(p.planSchedule) &&
      (p.planSchedule as unknown[]).length > 0
    );
  }

  async function applySameShapeFromActivePlan() {
    const active = activePlanForOtherRace;
    if (!active) return;
    setLoadingSameShape(true);
    setFormError(null);
    try {
      const token = await getToken();
      const { plan } = await fetchTrainingPlanDetail(active.id, token);
      const detail = plan as {
        presetId?: string | null;
        athletePresetId?: string | null;
        weeklyMileageTarget?: number | null;
        currentFiveKPace?: string | null;
        training_plan_preset?: { title?: string } | null;
      };
      if (detail.athletePresetId) {
        setSelectedAthletePresetId(detail.athletePresetId);
        setSelectedPreset(null);
      } else if (detail.presetId) {
        const match = prodPresets.find((p) => p.id === detail.presetId);
        if (match) {
          setSelectedPreset(match);
          setSelectedAthletePresetId(null);
        } else {
          setFormError(
            "Could not load your current plan blueprint. Try Create your own instead."
          );
          return;
        }
      } else {
        setFormError(
          "Your current plan has no blueprint to reuse. Try Create your own instead."
        );
        return;
      }
      if (
        detail.weeklyMileageTarget != null &&
        Number.isFinite(Number(detail.weeklyMileageTarget))
      ) {
        setBaselineWeeklyMileage(String(Math.round(Number(detail.weeklyMileageTarget))));
      }
      if (detail.currentFiveKPace?.trim()) {
        const parts = parseFiveKPaceToParts(detail.currentFiveKPace);
        setPaceMin(parts.min);
        setPaceSec(parts.sec);
      }
      setChangeRaceForkChoice("same-shape");
      setReplaceGoalAcknowledged(true);
      setPresetPickMode("choose");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not load your current plan");
    } finally {
      setLoadingSameShape(false);
    }
  }

  if (!ready) {
    return (
      <AthleteAppShell>
        <div className="flex min-h-[50vh] items-center justify-center text-gray-600">Loading…</div>
      </AthleteAppShell>
    );
  }

  if (wizardGoal && wizardGoal.athlete_race?.raceRegistryId) {
    const rr = wizardGoal.athlete_race;
    const goalDistanceLine = raceDistanceDisplayForGoal({
      id: rr.raceRegistryId,
      name: rr.name,
      raceDate: rr.raceDate,
      distanceMeters: rr.distanceMeters,
      distanceLabel: rr.distanceLabel,
      city: rr.city,
      state: rr.state,
    });

    const weeklyN = baselineWeeklyMileage.trim() === "" ? NaN : Number(baselineWeeklyMileage);
    const baseLongRunPoolMilesPreset = selectedPreset?.baseLongRunPoolMiles;
    const rampBanner =
      selectedPreset != null &&
      Number.isFinite(weeklyN) &&
      weeklyN > 0 &&
      Number.isFinite(baseLongRunPoolMilesPreset) ? (
        weeklyN < (baseLongRunPoolMilesPreset as number) * 0.75 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-medium text-amber-950">We&apos;ll build you up</p>
            <p className="mt-1 text-amber-900/90">
              Your plan starts with a gradual increase in volume to get you to your full training
              load without overloading.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-medium text-emerald-900">You&apos;re ready for this plan</p>
            <p className="mt-1 text-emerald-900/90">
              Your current mileage puts you right in range. Your plan starts at full training
              volume from week one.
            </p>
          </div>
        )
      ) : null;

    const needsGoalTimeStep = !goalTimeReady(wizardGoal);

    const showChangeRaceFork =
      Boolean(activePlanForOtherRace) &&
      changeRaceForkChoice === null &&
      !needsGoalTimeStep;

    const hasBlueprintSelected =
      selectedPreset != null || selectedAthletePresetId != null;

    const stepChoosePreset =
      !showChangeRaceFork &&
      !hasBlueprintSelected &&
      (presetPickMode === "choose" ||
        (presetPickMode === "catalog" && !selectedPreset) ||
        (presetPickMode === "custom" && !selectedAthletePresetId));

    function onSelectPreset(p: PresetForWizard) {
      setSelectedPreset(p);
      setSelectedAthletePresetId(null);
      setFormError(null);
    }

    const baselinePresetTitle =
      selectedPreset?.title ?? (selectedAthletePresetId ? "Your preset" : "");

    const inAthletePresetBuildFlow =
      stepChoosePreset && presetPickMode === "custom";

    async function getTokenForIngest() {
      const u = auth.currentUser;
      if (!u) throw new Error("Sign in required");
      return u.getIdToken();
    }

    return (
      <AthleteAppShell>
        <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm sm:p-8">
            {inAthletePresetBuildFlow ? (
              <>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight">Create your preset</h1>
                <p className="mb-4 text-sm text-gray-600">
                  For{" "}
                  <span className="font-medium text-gray-900">{rr.name}</span> —{" "}
                  {formatRaceWhen(rr.raceDate)}
                  {goalDistanceLine ? ` · ${goalDistanceLine}` : ""}. Build your training blueprint
                  here — you&apos;ll attach it to a plan after.
                </p>
              </>
            ) : (
              <>
                <h1 className="mb-2 text-2xl font-semibold tracking-tight">Plan setup</h1>
                <p className="mb-4 text-sm text-gray-600">
                  Goal:{" "}
                  <span className="font-medium text-gray-900">{rr.name}</span> —{" "}
                  {formatRaceWhen(rr.raceDate)}
                  {goalDistanceLine ? ` · ${goalDistanceLine}` : ""}.
                </p>
              </>
            )}

            {needsGoalTimeStep ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-gray-800">
                  <p className="font-medium text-gray-900">Set a goal time first</p>
                  <p className="mt-1 text-gray-700">
                    Add a plan needs a finish-time goal for {rr.name}.
                  </p>
                </div>
                <InlineGoalForm
                  race={{
                    athleteRaceId: wizardGoal.id,
                    name: rr.name,
                    raceDate: rr.raceDate,
                    distanceLabel: rr.distanceLabel ?? null,
                    distanceMeters: rr.distanceMeters ?? null,
                  }}
                  goal={{
                    id: wizardGoal.id,
                    goalTime: wizardGoal.goalTime,
                    athleteRaceId: wizardGoal.athleteRaceId,
                  }}
                  onSaved={handleInitiateGoalSaved}
                />
                <button
                  type="button"
                  onClick={exitWizard}
                  className="text-sm font-medium text-orange-600 hover:text-orange-800"
                >
                  ← Back
                </button>
              </div>
            ) : showChangeRaceFork && activePlanForOtherRace ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-gray-800">
                  <p className="font-medium text-gray-900">
                    Switch training to {rr.name}?
                  </p>
                  <p className="mt-2 leading-relaxed text-gray-700">
                    You have an active plan for{" "}
                    <span className="font-medium text-gray-900">
                      {activePlanForOtherRace.race_registry?.name ?? "another race"}
                    </span>
                    . Starting a plan for {rr.name} will park that plan.
                  </p>
                  {replacingFromAddedRace ? (
                    <p className="mt-2 text-xs text-amber-900/90">
                      Your current plan will be parked when you finish setup.
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    disabled={loadingSameShape}
                    onClick={() => void applySameShapeFromActivePlan()}
                    className="rounded-xl border-2 border-orange-300 bg-orange-50 p-4 text-left hover:border-orange-400 hover:bg-orange-50/80 disabled:opacity-60"
                  >
                    <p className="font-semibold text-gray-900">Keep this build</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Same training level and weekly preferences — new race date and window.
                    </p>
                    {loadingSameShape ? (
                      <p className="mt-2 text-xs font-medium text-orange-800">Loading…</p>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={loadingSameShape}
                    onClick={() => {
                      setChangeRaceForkChoice("create-own");
                      setPresetPickMode("choose");
                      setFormError(null);
                    }}
                    className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-left hover:border-orange-400 hover:bg-orange-50/50 disabled:opacity-60"
                  >
                    <p className="font-semibold text-gray-900">Create your own</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Pick a different GoFast level or build your own blueprint.
                    </p>
                  </button>
                </div>
                {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
                <button
                  type="button"
                  onClick={exitWizard}
                  className="text-sm font-medium text-orange-600 hover:text-orange-800"
                >
                  ← Back
                </button>
              </div>
            ) : stepChoosePreset ? (
              <>
                {presetPickMode === "choose" ? (
                  <>
                    <div className="mb-6 rounded-xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-gray-800">
                      <p className="text-lg font-semibold text-gray-900">
                        Welcome back{athleteFirstName ? `, ${athleteFirstName}` : ""}
                      </p>
                      <p className="mt-2 font-medium text-gray-900">How do you want to build?</p>
                      <p className="mt-1 leading-relaxed text-gray-700">
                        Use a GoFast training level, or create your own blueprint. Tell us your
                        history and your goal.
                      </p>
                      {replacingFromAddedRace ? (
                        <p className="mt-2 text-xs text-amber-900/90">
                          Your current plan will be{" "}
                          {retireActivePlanFromUrl === "archive" ? "archived" : "parked"} when you
                          finish setup.
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => setPresetPickMode("catalog")}
                        className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-left hover:border-orange-400 hover:bg-orange-50/50"
                      >
                        <p className="font-semibold text-gray-900">Use a GoFast preset</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Coach-built training levels for your race distance.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPresetPickMode("custom")}
                        className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-left hover:border-orange-400 hover:bg-orange-50/50"
                      >
                        <p className="font-semibold text-gray-900">Create my own preset</p>
                        <p className="mt-1 text-sm text-gray-600">
                          Train how you want to train. Tell us your history and goal — we&apos;ll
                          size your long-run pool and weekly blueprint.
                        </p>
                      </button>
                    </div>
                  </>
                ) : presetPickMode === "custom" ? (
                  customBuilderPresetId !== undefined ? (
                  <AthletePresetBuilder
                    getToken={getTokenForIngest}
                    templatePresets={presetsForWizardGoal}
                    resumePresetId={customBuilderPresetId}
                    raceDistanceMeters={rr.distanceMeters ?? null}
                    raceName={rr.name}
                    raceDate={rr.raceDate}
                    planStartDate={startDate || new Date().toISOString()}
                    goalTime={wizardGoal.goalTime}
                    onComplete={(ap) => {
                      setSelectedAthletePresetId(ap.id);
                      setSelectedPreset(null);
                      setCustomBuilderPresetId(undefined);
                      if (!planNameTouched) {
                        setPlanName(ap.title);
                      }
                    }}
                    onCancel={() => {
                      setCustomBuilderPresetId(undefined);
                      void loadAthletePresets();
                    }}
                  />
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-gray-800">
                        <p className="font-medium text-gray-900">Your presets</p>
                        <p className="mt-1 text-gray-700">
                          Pick up where you left off, delete drafts you don&apos;t need, or create
                          a new blueprint.
                        </p>
                        <button
                          type="button"
                          onClick={() => setPresetPickMode("choose")}
                          className="mt-2 text-sm font-medium text-orange-600 hover:text-orange-800"
                        >
                          ← Back
                        </button>
                      </div>

                      {loadingAthletePresets ? (
                        <p className="text-sm text-gray-600">Loading your presets…</p>
                      ) : (
                        <>
                          {savedAthletePresets.some((ap) => !ap.isComplete) ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                In progress
                              </p>
                              <ul className="space-y-2">
                                {savedAthletePresets
                                  .filter((ap) => !ap.isComplete)
                                  .map((ap) => (
                                    <li
                                      key={ap.id}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3"
                                    >
                                      <div>
                                        <p className="font-medium text-gray-900">{ap.title}</p>
                                        <p className="text-xs text-gray-600">
                                          {ap.buildStepLabel ??
                                            `Stopped at: ${ap.buildStep}`}
                                          {" · "}
                                          {new Date(ap.updatedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                                        <button
                                          type="button"
                                          onClick={() => setCustomBuilderPresetId(ap.id)}
                                          className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
                                        >
                                          Resume
                                        </button>
                                        <button
                                          type="button"
                                          disabled={deletingPresetId === ap.id}
                                          onClick={() => void (async () => {
                                            if (
                                              !window.confirm(
                                                `Delete "${ap.title}"? This cannot be undone.`
                                              )
                                            ) {
                                              return;
                                            }
                                            setDeletingPresetId(ap.id);
                                            try {
                                              const token = await getTokenForIngest();
                                              const res = await fetch(
                                                `/api/athlete-presets/${ap.id}`,
                                                {
                                                  method: "DELETE",
                                                  headers: athleteBearerFetchHeaders(token),
                                                }
                                              );
                                              if (!res.ok) {
                                                const data = (await res.json()) as {
                                                  error?: string;
                                                };
                                                window.alert(
                                                  data.error ?? "Could not delete preset"
                                                );
                                                return;
                                              }
                                              if (selectedAthletePresetId === ap.id) {
                                                setSelectedAthletePresetId(null);
                                              }
                                              await loadAthletePresets();
                                            } finally {
                                              setDeletingPresetId(null);
                                            }
                                          })()}
                                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
                                        >
                                          {deletingPresetId === ap.id ? "Deleting…" : "Delete"}
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          ) : null}

                          {savedAthletePresets.some((ap) => ap.isComplete) ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Ready to use
                              </p>
                              <ul className="space-y-2">
                                {savedAthletePresets
                                  .filter((ap) => ap.isComplete)
                                  .map((ap) => (
                                    <li
                                      key={ap.id}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"
                                    >
                                      <div>
                                        <p className="font-medium text-gray-900">{ap.title}</p>
                                        <p className="text-xs text-gray-600">
                                          {ap.buildStepLabel ??
                                            `Stopped at: ${ap.buildStep}`}
                                          {" · "}
                                          {new Date(ap.updatedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedAthletePresetId(ap.id);
                                            setSelectedPreset(null);
                                            if (!planNameTouched) setPlanName(ap.title);
                                          }}
                                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                                        >
                                          Use preset
                                        </button>
                                        <button
                                          type="button"
                                          disabled={deletingPresetId === ap.id}
                                          onClick={() => void (async () => {
                                            if (
                                              !window.confirm(
                                                `Delete "${ap.title}"? This cannot be undone.`
                                              )
                                            ) {
                                              return;
                                            }
                                            setDeletingPresetId(ap.id);
                                            try {
                                              const token = await getTokenForIngest();
                                              const res = await fetch(
                                                `/api/athlete-presets/${ap.id}`,
                                                {
                                                  method: "DELETE",
                                                  headers: athleteBearerFetchHeaders(token),
                                                }
                                              );
                                              if (!res.ok) {
                                                const data = (await res.json()) as {
                                                  error?: string;
                                                };
                                                window.alert(
                                                  data.error ?? "Could not delete preset"
                                                );
                                                return;
                                              }
                                              if (selectedAthletePresetId === ap.id) {
                                                setSelectedAthletePresetId(null);
                                              }
                                              await loadAthletePresets();
                                            } finally {
                                              setDeletingPresetId(null);
                                            }
                                          })()}
                                          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
                                        >
                                          {deletingPresetId === ap.id ? "Deleting…" : "Delete"}
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          ) : null}

                          {savedAthletePresets.length === 0 ? (
                            <p className="text-sm text-gray-600">No saved presets yet.</p>
                          ) : null}
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setCustomBuilderPresetId(null)}
                        className="w-full rounded-xl border-2 border-orange-300 bg-orange-50 py-3 text-sm font-semibold text-orange-900 hover:bg-orange-100"
                      >
                        Create new preset
                      </button>
                    </div>
                  )
                ) : (
                  <>
                    <div className="mb-6 rounded-xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-gray-800">
                      <p className="font-medium text-gray-900">Pick a GoFast training level</p>
                      <button
                        type="button"
                        onClick={() => setPresetPickMode("choose")}
                        className="mt-2 text-sm font-medium text-orange-600 hover:text-orange-800"
                      >
                        ← Back
                      </button>
                    </div>
                    <div className="space-y-4">
                      {loadingOrientation ? (
                        <p className="text-sm text-gray-600">Loading your training level…</p>
                      ) : presetsForWizardGoal.length === 0 ? (
                        <div className="text-sm text-amber-950">
                          <p className="font-medium">No level for this race distance</p>
                        </div>
                      ) : (
                        <ul className="grid gap-3 sm:grid-cols-1">
                          {presetsForWizardGoal.map((p) => {
                            const blurb = p.publicDescription ?? p.description;
                            return (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  onClick={() => onSelectPreset(p)}
                                  className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-left transition hover:border-orange-400 hover:bg-orange-50/50 sm:p-5"
                                >
                                  <p className="text-lg font-semibold text-gray-900">{p.title}</p>
                                  {blurb ? (
                                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                                      {blurb}
                                    </p>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-gray-800">
                  <p className="font-medium text-gray-900">Tell us your current fitness level</p>
                  <p className="mt-2 leading-relaxed text-gray-700">
                    We use these to set the right starting point. We&apos;ll save them to your profile.
                  </p>
                </div>

                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {baselinePresetTitle}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPreset(null);
                    setSelectedAthletePresetId(null);
                    setPresetPickMode("choose");
                    setFormError(null);
                  }}
                  className="mb-5 text-sm font-medium text-orange-600 hover:text-orange-800"
                >
                  ← Change preset
                </button>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        What&apos;s your current 5K pace?
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={2}
                          max={30}
                          placeholder="min"
                          className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          value={paceMin}
                          onChange={(e) => setPaceMin(e.target.value)}
                        />
                        <span className="text-gray-500">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          placeholder="sec"
                          className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          value={paceSec}
                          onChange={(e) => setPaceSec(e.target.value)}
                        />
                        <span className="text-sm text-gray-600">min / mile</span>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        How many miles per week are you running right now?
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        value={baselineWeeklyMileage}
                        onChange={(e) => setBaselineWeeklyMileage(e.target.value)}
                      />
                      <p className="mt-1.5 text-xs text-gray-600">
                        This is your baseline today — not your goal. You&apos;ll set target weekly
                        mileage on the next step.
                      </p>
                    </div>
                  </div>

                  {rampBanner}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-800">
                      Plan name
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={planName}
                      onChange={(e) => {
                        setPlanNameTouched(true);
                        setPlanName(e.target.value);
                        setFormError(null);
                      }}
                    />
                    <p className="mt-1.5 text-xs text-gray-600">
                      This is the title for your plan — used when you share it publicly.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-800">
                      Plan start date
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setFormError(null);
                      }}
                    />
                  </div>

                  {formError && <p className="text-sm text-amber-800">{formError}</p>}

                  {replaceBlockPlan && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="mb-2 font-medium text-amber-950">
                        You already have an active plan for this goal
                      </p>
                      <p className="mb-3 text-amber-900/90">
                        Open it to keep your schedule, or start a fresh plan — your current training
                        will be saved to history.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/training-setup/${replaceBlockPlan.id}`)
                          }
                          className="inline-flex justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-amber-600"
                        >
                          Open existing plan
                        </button>
                        <button
                          type="button"
                          disabled={creating || loadingOrientation || (!selectedPreset && !selectedAthletePresetId)}
                          onClick={() => void createPlan({ forceReplace: true })}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Start fresh with this goal
                        </button>
                      </div>
                    </div>
                  )}

                  {createFeedback === "goals" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                      <p className="mb-2 font-medium">Let&apos;s update your goal first</p>
                      <p className="mb-3 text-amber-900/90">
                        We couldn&apos;t start a plan from here—your goal or race may have changed, or
                        something needs to be finished in Goals. Nothing&apos;s wrong with your account;
                        just confirm your race and goal time, then try again.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Link
                          href="/goals"
                          className="inline-flex justify-center rounded-lg bg-amber-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-amber-600"
                        >
                          Open Goals
                        </Link>
                        <button
                          type="button"
                          onClick={() => void refreshGoalsAndExitWizard()}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          Refresh goal list
                        </button>
                      </div>
                    </div>
                  )}

                  {createFeedback === "dates" && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                      <p className="mb-2 font-medium">Check your start date</p>
                      <p className="text-sky-900/90">
                        Your plan needs to start before race day. Pick an earlier date above, then tap
                        Choose preferences again.
                      </p>
                    </div>
                  )}

                  {createFeedback === "preset" && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                      <p className="mb-2 font-medium text-red-950">Training level not available</p>
                      <p className="mb-3 text-red-900/95">
                        We couldn&apos;t load a training level for your account. Tap retry, or contact
                        support.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void loadOrientation()}
                          className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateFeedback(null)}
                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}

                  {createFeedback === "generic" && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                      <p className="mb-3">
                        We couldn&apos;t create your plan just now. Please try again in a moment.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCreateFeedback(null)}
                        className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => void createPlan()}
                    disabled={creating || loadingOrientation || (!selectedPreset && !selectedAthletePresetId)}
                    className="w-full rounded-lg bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {creating ? "Continuing…" : "Choose preferences"}
                  </button>

                  <button
                    type="button"
                    onClick={exitWizard}
                    className="block w-full text-center text-sm text-gray-500 hover:text-gray-800"
                  >
                    Back to goal selection
                  </button>

                  <Link href="/training" className="block text-center text-sm text-gray-500 hover:text-orange-600">
                    Exit to Training Hub
                  </Link>
                </div>
              </>
            )}

            {!stepChoosePreset ? null : (
              <div className="mt-8 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={exitWizard}
                  className="block w-full text-center text-sm text-gray-500 hover:text-gray-800"
                >
                  Back to goal selection
                </button>
                <Link
                  href="/training"
                  className="mt-2 block text-center text-sm text-gray-500 hover:text-orange-600"
                >
                  Exit to Training Hub
                </Link>
              </div>
            )}
          </div>
        </div>
      </AthleteAppShell>
    );
  }

  return (
    <AthleteAppShell>
      <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-sm sm:p-8">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Training plan</h1>
          <p className="mb-6 text-base text-gray-600">
            We&apos;ll build your plan for you once you pick a goal—weekly miles, preferred
            days, then we generate the workouts. You need an active goal with a race and goal time.
          </p>

          {loadingOrientation && (
            <p className="text-sm text-gray-500">Loading your goals…</p>
          )}

          {orientationError && (
            <p className="mb-4 text-sm text-red-600">{orientationError}</p>
          )}

          {!loadingOrientation && activePlans.length > 0 && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="mb-1 font-medium text-emerald-900">Your active plan</p>
              <p className="mb-1 text-emerald-900/95">{activePlans[0].name}</p>
              {activePlans[0].race_registry?.name && (
                <p className="mb-3 text-xs text-emerald-800/90">
                  {activePlans[0].race_registry.name}
                  {scheduleReady(activePlans[0]) ? " · Schedule ready" : " · Not generated yet"}
                </p>
              )}
              <Link
                href={`/training-setup/${activePlans[0].id}`}
                className="mb-2 inline-flex w-full justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:w-auto"
              >
                Continue to plan
              </Link>
              <p className="mt-3 text-xs text-emerald-800/80">
                Pick a goal below if you&apos;re aiming at a different race. Starting another plan for
                the same goal saves your current plan first — we&apos;ll confirm before swapping.
              </p>
            </div>
          )}

          {!loadingOrientation && pastRaceGoals.length > 0 && (
            <div className="mb-6 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">Past race</h2>
              <ul className="space-y-3">
                {pastRaceGoals.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Complete
                    </p>
                    <div className="mb-1 font-medium text-gray-900">{g.athlete_race?.name ?? "Race"}</div>
                    <div className="text-xs text-gray-600 mb-3">
                      {g.athlete_race
                        ? `${formatRaceWhen(g.athlete_race.raceDate)} · Goal time ${g.goalTime}`
                        : g.goalTime}
                    </div>
                    <p className="text-sm text-gray-700 mb-3">
                      That race date has passed. Log your result or browse for your next one.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {g.athlete_race?.raceRegistryId ? (
                        <Link
                          href={`/race-hub/${g.athlete_race?.raceRegistryId}`}
                          className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                        >
                          Log your result
                        </Link>
                      ) : null}
                      <Link
                        href="/races"
                        className="inline-flex justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                      >
                        Find your next race
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loadingOrientation && qualifyingGoals.length > 0 && (
            <ul className="mb-6 space-y-3">
              {qualifyingGoals.map((g) => (
                <li
                  key={g.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
                >
                  <div className="mb-2 font-medium text-gray-900">
                    {g.athlete_race?.name ?? "Race"}
                  </div>
                  <div className="text-xs text-gray-600">
                    {g.athlete_race
                      ? `${formatRaceWhen(g.athlete_race.raceDate)} · Goal time ${g.goalTime}`
                      : g.goalTime}
                  </div>
                  <button
                    type="button"
                    onClick={() => beginWizardForGoal(g)}
                    className="mt-3 w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
                  >
                    Add a plan
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && activeNeedsRace && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="mb-2 font-medium">Step 1 — Add a race to your goal</p>
              <p className="mb-3 text-amber-900/90">
                Plans are tied to a specific race in your goal — pick one in Goals.
              </p>
              <Link
                href="/goals"
                className="inline-block rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Open Goals
              </Link>
            </div>
          )}

          {!loadingOrientation && qualifyingGoals.length === 0 && incompleteRaceNeedsTime && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="mb-2 font-medium">Step 2 — Set a goal time</p>
              <p className="mb-3 text-amber-900/90">
                Add a finish time target in Goals so we can build your plan around it.
              </p>
              <Link
                href="/goals"
                className="inline-block rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                Open Goals
              </Link>
            </div>
          )}

          {!loadingOrientation &&
            qualifyingGoals.length === 0 &&
            futureSignups.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-medium text-gray-800">Signed up · need a goal</h2>
              <p className="mb-3 text-xs text-gray-500">
                Set a goal time for your next race — then you can generate your training plan.
              </p>
              <ul className="space-y-3">
                {futureSignups.map((s) => {
                  const r = s.race_registry;
                  if (!r) return null;
                  return (
                    <li
                      key={s.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
                    >
                      <p className="text-sm text-gray-700">
                        You&apos;re signed up for{" "}
                        <span className="font-semibold text-gray-900">{r.name}</span>{" "}
                        <span className="text-gray-600">
                          ({formatRaceWhen(r.raceDate)}).
                        </span>{" "}
                        Set a goal time to unlock your training plan.
                      </p>
                      <Link
                        href={`/goals?raceRegistryId=${encodeURIComponent(s.raceRegistryId)}`}
                        className="mt-3 inline-flex w-full justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 sm:w-auto"
                      >
                        Set goal
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!loadingOrientation &&
            qualifyingGoals.length === 0 &&
            pastRaceGoals.length === 0 &&
            futureSignups.length === 0 &&
            !incompleteRaceNeedsTime &&
            !activeNeedsRace && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
                <h2 className="mb-2 text-lg font-semibold text-gray-900">
                  What&apos;s your next race?
                </h2>
                <p className="mb-4 leading-relaxed">
                  Training plans are built around a race goal. Browse races to find your next one,
                  then set a goal time — we&apos;ll build the plan from there.
                </p>
                <Link
                  href="/races"
                  className="inline-flex w-full justify-center rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 sm:w-auto"
                >
                  Browse races
                </Link>
              </div>
            )}

          <div className="border-t border-gray-200 pt-4 text-center">
            <Link href="/goals" className="text-sm text-gray-500 hover:text-orange-600">
              Manage goals
            </Link>
            <span className="mx-2 text-gray-300">·</span>
            <Link href="/training" className="text-sm text-gray-500 hover:text-orange-600">
              Back to Training Hub
            </Link>
          </div>
        </div>
      </div>
    </AthleteAppShell>
  );
}
