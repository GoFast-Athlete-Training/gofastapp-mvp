"use client";

import { useCallback, useEffect, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { ageYearsFromBirthday } from "@/lib/training/athlete-preset-volume";
import { weeklyVolumeKeyForDistance } from "@/lib/training/weekly-volume-key";
import {
  DEFAULT_ATHLETE_PACE_ADJUSTER,
  type AthletePaceAdjuster,
} from "@/lib/training/athlete-pace-adjuster";

export type PresetForWizardLite = {
  id: string;
  title: string;
};

export type AthletePresetIngestResult = {
  id: string;
  title: string;
};

type ConfigPosition = {
  id: string;
  cyclePosition: number;
  distributionWeight: number;
  catalogueWorkoutId: string | null;
  workout_catalogue?: { name: string; workoutType: string } | null;
};

type AthletePresetApi = AthletePresetIngestResult & {
  buildStep:
    | "core"
    | "longRun"
    | "easy"
    | "tempo"
    | "interval"
    | "adjuster"
    | "complete";
  isComplete: boolean;
  description: string | null;
  fitnessPhase: "PEAK" | "BASE";
  trainingHistory: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  baseLongRunPoolMiles: number;
  peakLongRunPoolMiles: number;
  taperLongRunPoolMiles: number;
  workoutStructure: unknown;
  coachPlanOverview: unknown;
  longRunConfig?: { positions: ConfigPosition[] } | null;
  easyConfig?: { positions: ConfigPosition[] } | null;
  tempoConfig?: { positions: ConfigPosition[] } | null;
  intervalsConfig?: { positions: ConfigPosition[] } | null;
};

type CorePreview = {
  weSeeYou: string;
  barriers: string[];
  progressionAggressiveness: string;
  weeklyVolumeBand?: "FINISH" | "RACE" | "ELITE";
  minWeeklyMiles?: number;
  maxWeeklyMiles?: number | null;
  longestSaturdayMiles?: number;
  calendar: {
    totalWeeks: number;
    totalCycles: number;
    poolMilesByCycle: number[];
    peakWeekNumber: number | null;
    taperStartWeekNumber: number;
    longRunCycleWeeks: number;
    peakLongRunDate?: string | null;
    taperStartDate?: string | null;
    peakPoolKey?: { weekNumber: number; date: string; miles: number }[];
  };
  peakPoolKey?: { weekNumber: number; date: string; miles: number }[];
  peakLongRunDate?: string | null;
  taperStartDate?: string | null;
};

type AthletePresetBuilderProps = {
  getToken: () => Promise<string>;
  templatePresets: PresetForWizardLite[];
  resumePresetId?: string | null;
  raceDistanceMeters: number | null;
  raceName: string;
  raceDate: string;
  planStartDate: string;
  goalTime: string | null;
  onComplete: (preset: AthletePresetIngestResult) => void;
  onCancel: () => void;
};

type BuilderStep =
  | "intro"
  | "foundation"
  | "longRun"
  | "easy"
  | "tempo"
  | "interval"
  | "adjuster";

function buildStepToUi(step: AthletePresetApi["buildStep"]): BuilderStep {
  if (step === "core") return "foundation";
  if (step === "complete") return "adjuster";
  return step;
}

function catalogueNames(positions: ConfigPosition[] | undefined): string[] {
  if (!positions?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of [...positions].sort((a, b) => a.cyclePosition - b.cyclePosition)) {
    const name = p.workout_catalogue?.name?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export function AthletePresetBuilder({
  getToken,
  templatePresets,
  resumePresetId,
  raceDistanceMeters,
  raceName,
  raceDate,
  planStartDate,
  goalTime,
  onComplete,
  onCancel,
}: AthletePresetBuilderProps) {
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [presetId, setPresetId] = useState<string | null>(resumePresetId ?? null);
  const [step, setStep] = useState<BuilderStep>("intro");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trainingHistory, setTrainingHistory] = useState("");
  const [profilePrefill, setProfilePrefill] = useState("");
  const [fitnessPhase, setFitnessPhase] = useState<"PEAK" | "BASE">("PEAK");
  const [longRunCapabilityMiles, setLongRunCapabilityMiles] = useState("");
  const [birthdayInput, setBirthdayInput] = useState("");
  const [ageYears, setAgeYears] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [needsBirthday, setNeedsBirthday] = useState(false);
  const [baseLongRunPoolMiles, setBaseMiles] = useState("");
  const [peakLongRunPoolMiles, setPeakMiles] = useState("");
  const [taperLongRunPoolMiles, setTaperMiles] = useState("");
  const [minWeeklyMiles, setMinWeeklyMiles] = useState("");
  const [maxWeeklyMiles, setMaxWeeklyMiles] = useState<number | null>(null);
  const [corePreview, setCorePreview] = useState<CorePreview | null>(null);
  const [showPoolAdjust, setShowPoolAdjust] = useState(false);
  const [presetApi, setPresetApi] = useState<AthletePresetApi | null>(null);
  const [lrOrder, setLrOrder] = useState<ConfigPosition[]>([]);
  const [paceAdjuster, setPaceAdjuster] = useState<AthletePaceAdjuster>({
    ...DEFAULT_ATHLETE_PACE_ADJUSTER,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrateFromPreset = useCallback(
    (ap: AthletePresetApi) => {
      setPresetId(ap.id);
      setPresetApi(ap);
      setTitle(ap.title);
      setDescription(ap.description ?? "");
      setTrainingHistory(ap.trainingHistory ?? "");
      setFitnessPhase(ap.fitnessPhase);
      setBaseMiles(String(ap.baseLongRunPoolMiles));
      setPeakMiles(String(ap.peakLongRunPoolMiles));
      setTaperMiles(String(ap.taperLongRunPoolMiles));
      setMinWeeklyMiles(String(ap.minWeeklyMiles));
      setMaxWeeklyMiles(ap.maxWeeklyMiles);
      const positions = ap.longRunConfig?.positions ?? [];
      setLrOrder([...positions].sort((a, b) => a.cyclePosition - b.cyclePosition));

      if (ap.buildStep === "core") {
        const overview = ap.coachPlanOverview as Record<string, unknown> | null;
        if (overview?.weSeeYou && typeof overview.weSeeYou === "string") {
          setCorePreview({
            weSeeYou: overview.weSeeYou,
            barriers: Array.isArray(overview.barriers)
              ? overview.barriers.filter((b): b is string => typeof b === "string")
              : [],
            progressionAggressiveness:
              typeof overview.progressionAggressiveness === "string"
                ? overview.progressionAggressiveness
                : "MODERATE",
            weeklyVolumeBand:
              overview.weeklyVolumeBand === "FINISH" ||
              overview.weeklyVolumeBand === "RACE" ||
              overview.weeklyVolumeBand === "ELITE"
                ? overview.weeklyVolumeBand
                : undefined,
            minWeeklyMiles:
              typeof overview.minWeeklyMiles === "number" ? overview.minWeeklyMiles : ap.minWeeklyMiles,
            maxWeeklyMiles:
              typeof overview.maxWeeklyMiles === "number"
                ? overview.maxWeeklyMiles
                : ap.maxWeeklyMiles,
            peakPoolKey: Array.isArray(overview.peakPoolKey)
              ? (overview.peakPoolKey as CorePreview["peakPoolKey"])
              : [],
            peakLongRunDate:
              typeof overview.peakLongRunDate === "string" ? overview.peakLongRunDate : null,
            taperStartDate:
              typeof overview.taperStartDate === "string" ? overview.taperStartDate : null,
            calendar: {
              totalWeeks: Number(overview.totalWeeks) || 0,
              totalCycles: 0,
              poolMilesByCycle: Array.isArray(overview.poolMilesByCycle)
                ? overview.poolMilesByCycle.map(Number)
                : [],
              peakWeekNumber: null,
              taperStartWeekNumber: 0,
              longRunCycleWeeks: 4,
            },
          });
        }
      }
      if (ap.isComplete) {
        onComplete({ id: ap.id, title: ap.title });
        return;
      }
      setStep(buildStepToUi(ap.buildStep));
    },
    [onComplete]
  );

  useEffect(() => {
    void (async () => {
      setLoadingProfile(true);
      try {
        const token = await getToken();
        const headers = athleteBearerFetchHeaders(token);
        const meRes = await fetch("/api/athlete/me", { headers });
        const meData = (await meRes.json()) as { athleteId?: string };
        if (!meRes.ok || !meData.athleteId) {
          throw new Error("Could not load athlete profile");
        }
        setAthleteId(meData.athleteId);

        const profileRes = await fetch(`/api/athlete/${meData.athleteId}`, { headers });
        const profileData = (await profileRes.json()) as {
          athlete?: {
            birthday?: string | null;
            gender?: string | null;
            weeklyMileage?: number | null;
            fiveKPace?: string | null;
            longRunCapabilityMiles?: number | null;
            paceAdjusterEasySecPerMile?: number | null;
            paceAdjusterLongRunSecPerMile?: number | null;
            paceAdjusterThresholdSecPerMile?: number | null;
            paceAdjusterIntervalSecPerMile?: number | null;
          };
        };
        const a = profileData.athlete;
        const age = ageYearsFromBirthday(a?.birthday ? new Date(a.birthday) : null);
        setAgeYears(age);
        setGender(a?.gender?.trim() || null);
        setNeedsBirthday(age == null);
        if (a?.birthday) setBirthdayInput(a.birthday.slice(0, 10));
        if (a?.longRunCapabilityMiles != null && Number.isFinite(a.longRunCapabilityMiles)) {
          setLongRunCapabilityMiles(String(a.longRunCapabilityMiles));
        }
        if (a) {
          setPaceAdjuster({
            easy: a.paceAdjusterEasySecPerMile ?? DEFAULT_ATHLETE_PACE_ADJUSTER.easy,
            longRun: a.paceAdjusterLongRunSecPerMile ?? DEFAULT_ATHLETE_PACE_ADJUSTER.longRun,
            threshold:
              a.paceAdjusterThresholdSecPerMile ?? DEFAULT_ATHLETE_PACE_ADJUSTER.threshold,
            interval:
              a.paceAdjusterIntervalSecPerMile ?? DEFAULT_ATHLETE_PACE_ADJUSTER.interval,
          });
        }

        const parts: string[] = [];
        if (a?.weeklyMileage != null && Number.isFinite(a.weeklyMileage)) {
          parts.push(`Running about ${Math.round(a.weeklyMileage)} miles per week recently.`);
        }
        if (a?.fiveKPace?.trim()) {
          parts.push(`5K pace around ${a.fiveKPace.trim()}.`);
        }
        if (a?.longRunCapabilityMiles != null && Number.isFinite(a.longRunCapabilityMiles)) {
          parts.push(
            `Longest recent long run about ${a.longRunCapabilityMiles.toFixed(1)} miles.`
          );
        }
        setProfilePrefill(parts.join(" "));

        if (resumePresetId) {
          const apRes = await fetch(`/api/athlete-presets/${resumePresetId}`, { headers });
          const apData = (await apRes.json()) as {
            athletePreset?: AthletePresetApi;
            error?: string;
          };
          if (apRes.ok && apData.athletePreset) {
            hydrateFromPreset(apData.athletePreset);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load profile");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [getToken, resumePresetId, hydrateFromPreset]);

  function addMyDetails() {
    if (!profilePrefill.trim()) return;
    setTrainingHistory((prev) => (prev.trim() ? prev : profilePrefill));
    const lrMatch = profilePrefill.match(/Longest recent long run about ([\d.]+) miles/);
    if (lrMatch && !longRunCapabilityMiles) {
      setLongRunCapabilityMiles(lrMatch[1]!);
    }
  }

  async function ensureBirthdaySaved(token: string): Promise<void> {
    if (!needsBirthday || !birthdayInput.trim() || !athleteId) return;
    const res = await fetch(`/api/athlete/${athleteId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...athleteBearerFetchHeaders(token) },
      body: JSON.stringify({ birthday: birthdayInput }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Could not save birthday");
    }
    setAgeYears(ageYearsFromBirthday(new Date(birthdayInput)));
    setNeedsBirthday(false);
  }

  async function ensureLongRunCapabilitySaved(token: string): Promise<void> {
    const raw = longRunCapabilityMiles.trim();
    if (!raw || !athleteId) return;
    const miles = Number(raw);
    if (!Number.isFinite(miles) || miles <= 0) return;
    const res = await fetch(`/api/athlete/${athleteId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...athleteBearerFetchHeaders(token) },
      body: JSON.stringify({ longRunCapabilityMiles: Math.round(miles * 10) / 10 }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string; message?: string };
      throw new Error(data.message ?? data.error ?? "Could not save longest long run");
    }
  }

  async function runCoreInfer() {
    const sourcePresetId = templatePresets[0]?.id;
    if (!sourcePresetId) {
      setError("No GoFast rotation template for this race distance.");
      return;
    }
    if (!title.trim()) {
      setError("Name your preset.");
      return;
    }
    if (!trainingHistory.trim()) {
      setError("Add your training history or tap Add my details.");
      return;
    }
    if (needsBirthday && !birthdayInput.trim()) {
      setError("Add your birthday so we can size your training.");
      return;
    }
    const lr = longRunCapabilityMiles.trim();
    if (!lr || !Number.isFinite(Number(lr)) || Number(lr) <= 0) {
      setError("Longest recent long run is required.");
      return;
    }
    if (presetId && corePreview) {
      setStep("foundation");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await ensureBirthdaySaved(token);
      await ensureLongRunCapabilitySaved(token);

      const res = await fetch("/api/athlete-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...athleteBearerFetchHeaders(token) },
        body: JSON.stringify({
          previewOnly: true,
          title: title.trim(),
          description: description.trim() || null,
          fitnessPhase,
          trainingHistory: trainingHistory.trim(),
          sourcePresetId,
          targetDistanceMeters: raceDistanceMeters,
          longRunCapabilityMiles: Number(longRunCapabilityMiles),
          raceName,
          raceDate,
          planStartDate,
          goalTime,
        }),
      });
      const data = (await res.json()) as {
        corePreview?: CorePreview;
        suggestedCups?: {
          baseLongRunPoolMiles: number;
          peakLongRunPoolMiles: number;
          taperLongRunPoolMiles: number;
          minWeeklyMiles: number;
          maxWeeklyMiles: number | null;
        };
        error?: string;
      };
      if (!res.ok || !data.suggestedCups) {
        setError(data.error ?? "Could not analyze your training");
        return;
      }
      setBaseMiles(String(data.suggestedCups.baseLongRunPoolMiles));
      setPeakMiles(String(data.suggestedCups.peakLongRunPoolMiles));
      setTaperMiles(String(data.suggestedCups.taperLongRunPoolMiles));
      setMinWeeklyMiles(String(data.suggestedCups.minWeeklyMiles));
      setMaxWeeklyMiles(data.suggestedCups.maxWeeklyMiles);
      if (data.corePreview) setCorePreview(data.corePreview);
      setShowPoolAdjust(false);
      setStep("foundation");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze your training");
    } finally {
      setSaving(false);
    }
  }

  async function patchPreset(body: Record<string, unknown>): Promise<AthletePresetApi> {
    if (!presetId) throw new Error("Preset not created yet");
    const token = await getToken();
    const res = await fetch(`/api/athlete-presets/${presetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...athleteBearerFetchHeaders(token) },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { athletePreset?: AthletePresetApi; error?: string };
    if (!res.ok || !data.athletePreset) {
      throw new Error(data.error ?? "Could not update preset");
    }
    setPresetApi(data.athletePreset);
    const positions = data.athletePreset.longRunConfig?.positions ?? [];
    setLrOrder([...positions].sort((a, b) => a.cyclePosition - b.cyclePosition));
    return data.athletePreset;
  }

  async function saveFoundationAndContinue() {
    const sourcePresetId = templatePresets[0]?.id;
    if (!sourcePresetId) {
      setError("No GoFast rotation template for this race distance.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const cupPayload = {
        baseLongRunPoolMiles: Number(baseLongRunPoolMiles),
        peakLongRunPoolMiles: Number(peakLongRunPoolMiles),
        taperLongRunPoolMiles: Number(taperLongRunPoolMiles),
        minWeeklyMiles: Number(minWeeklyMiles),
        maxWeeklyMiles: maxWeeklyMiles ?? corePreview?.maxWeeklyMiles ?? null,
      };

      let id = presetId;
      if (id) {
        await patchPreset({ step: "core", action: "confirmCups", ...cupPayload });
      } else {
        const res = await fetch("/api/athlete-presets", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...athleteBearerFetchHeaders(token) },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            fitnessPhase,
            trainingHistory: trainingHistory.trim(),
            sourcePresetId,
            targetDistanceMeters: raceDistanceMeters,
            longRunCapabilityMiles: Number(longRunCapabilityMiles),
            raceName,
            raceDate,
            planStartDate,
            goalTime,
            ...cupPayload,
          }),
        });
        const data = (await res.json()) as { athletePreset?: AthletePresetApi; error?: string };
        if (!res.ok || !data.athletePreset?.id) {
          setError(data.error ?? "Could not save your preset");
          return;
        }
        id = data.athletePreset.id;
        setPresetId(id);
        setPresetApi(data.athletePreset);
      }

      const setupRes = await fetch(`/api/athlete-presets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({ step: "core", action: "setupWorkouts" }),
      });
      const setupData = (await setupRes.json()) as {
        athletePreset?: AthletePresetApi;
        error?: string;
      };
      if (!setupRes.ok || !setupData.athletePreset) {
        throw new Error(setupData.error ?? "Could not set up workouts");
      }
      setPresetApi(setupData.athletePreset);
      setLrOrder(
        [...(setupData.athletePreset.longRunConfig?.positions ?? [])].sort(
          (a, b) => a.cyclePosition - b.cyclePosition
        )
      );
      setStep("longRun");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save foundation");
    } finally {
      setSaving(false);
    }
  }

  function moveLrPosition(index: number, direction: -1 | 1) {
    const next = [...lrOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setLrOrder(next);
  }

  async function confirmLongRunAndContinue() {
    setSaving(true);
    setError(null);
    try {
      const ordered = lrOrder.map((p) => p.id);
      const ap = await patchPreset({
        step: "longRun",
        action: ordered.length ? "reorderPositions" : "confirm",
        ...(ordered.length ? { orderedPositionIds: ordered } : {}),
      });
      if (ap.buildStep === "longRun") {
        await patchPreset({ step: "longRun", action: "confirm" });
      }
      setStep("easy");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save long run order");
    } finally {
      setSaving(false);
    }
  }

  async function confirmEasyAndContinue() {
    setSaving(true);
    setError(null);
    try {
      await patchPreset({ step: "easy", action: "confirm" });
      setStep("tempo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not continue");
    } finally {
      setSaving(false);
    }
  }

  async function confirmTempoAndContinue() {
    setSaving(true);
    setError(null);
    try {
      await patchPreset({ step: "tempo", action: "confirm" });
      setStep("interval");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not continue");
    } finally {
      setSaving(false);
    }
  }

  async function confirmIntervalAndContinue() {
    setSaving(true);
    setError(null);
    try {
      await patchPreset({ step: "interval", action: "confirm" });
      setStep("adjuster");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not continue");
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjusterAndFinish() {
    setSaving(true);
    setError(null);
    try {
      const ap = await patchPreset({
        step: "adjuster",
        action: "confirm",
        paceAdjuster,
      });
      if (ap.isComplete) {
        onComplete({ id: ap.id, title: ap.title });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save pace adjuster");
    } finally {
      setSaving(false);
    }
  }

  const peakPoolRows = corePreview?.peakPoolKey ?? corePreview?.calendar.peakPoolKey ?? [];
  const peakDate =
    corePreview?.peakLongRunDate ?? corePreview?.calendar.peakLongRunDate ?? null;
  const taperDate =
    corePreview?.taperStartDate ?? corePreview?.calendar.taperStartDate ?? null;
  const weeklyBand = corePreview?.weeklyVolumeBand;

  return (
    <div className="space-y-4">
      {step === "intro" && !loadingProfile ? (
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-gray-800">
          <p className="font-medium text-gray-900">Create your preset</p>
          <p className="mt-1 text-gray-700">
            Tell us your history and goal race — we&apos;ll infer your foundation, then lock in four
            run types.
          </p>
        </div>
      ) : null}

      {loadingProfile ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : step === "intro" ? (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">Name your preset</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">Description</label>
            <input
              type="text"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">Optional — just for you.</p>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-gray-800">Your training history</label>
              {profilePrefill ? (
                <button
                  type="button"
                  onClick={addMyDetails}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-800"
                >
                  Add my details
                </button>
              ) : null}
            </div>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
              placeholder="PR chaser, coming back from injury, first marathon…"
              value={trainingHistory}
              onChange={(e) => setTrainingHistory(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-800">Where in training?</p>
            <div className="flex flex-wrap gap-2">
              {(["PEAK", "BASE"] as const).map((phase) => (
                <button
                  key={phase}
                  type="button"
                  onClick={() => setFitnessPhase(phase)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                    fitnessPhase === phase
                      ? "bg-orange-600 text-white"
                      : "border border-gray-300 bg-white text-gray-800"
                  }`}
                >
                  {phase === "PEAK" ? "Peak — already built up" : "Base — building up"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Longest recent long run (mi) <span className="font-normal text-gray-500">(required)</span>
            </label>
            <input
              type="number"
              min={0}
              step={0.1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
              value={longRunCapabilityMiles}
              onChange={(e) => setLongRunCapabilityMiles(e.target.value)}
            />
          </div>
          {needsBirthday ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-800">Birthday</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
                value={birthdayInput}
                onChange={(e) => setBirthdayInput(e.target.value)}
              />
            </div>
          ) : ageYears != null ? (
            <p className="text-sm text-gray-600">
              Age {ageYears}
              {gender ? ` · ${gender}` : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void runCoreInfer()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? "Analyzing your training…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
            >
              ← Back
            </button>
          </div>
          {saving ? (
            <p className="text-sm text-gray-600">
              Hold on — we&apos;re sizing your peak long-run pool from your history…
            </p>
          ) : null}
        </>
      ) : step === "foundation" ? (
        <>
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
              <p className="text-lg font-semibold text-gray-900">
                Here&apos;s the foundation of everything.
              </p>
              <p className="mt-2 text-sm text-gray-700">
                This is <span className="font-medium">not</span> the miles you run this week. This is
                the band the plan has to hit — volume grows toward that peak pool and those dates.
              </p>
            </div>

            {corePreview?.weSeeYou ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-gray-800">
                <p className="font-medium text-gray-900">{corePreview.weSeeYou}</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Mileage min–max
                </p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {minWeeklyMiles || corePreview?.minWeeklyMiles || "—"}–
                  {maxWeeklyMiles ?? corePreview?.maxWeeklyMiles ?? "—"} mi
                </p>
                {weeklyBand ? (
                  <p className="mt-1 text-xs text-gray-500">
                    {weeklyVolumeKeyForDistance(null)[weeklyBand].athleteLabel}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Long-run pool (cycle peak max)
                </p>
                <p className="mt-1 text-lg font-bold text-orange-600">
                  {peakLongRunPoolMiles || "—"} mi
                </p>
                <p className="mt-1 text-xs text-gray-500">Sum of 4 Saturdays in your peak block</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Peak date</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{peakDate ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Taper date</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{taperDate ?? "—"}</p>
              </div>
            </div>

            {peakPoolRows.length ? (
              <div className="rounded-xl border border-sky-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Pool key — 4 Saturdays
                </p>
                <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {peakPoolRows.map((row) => (
                    <li
                      key={row.date}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="text-gray-700">
                        {row.date}
                        <span className="ml-2 text-gray-400">wk {row.weekNumber}</span>
                      </span>
                      <span className="font-semibold text-gray-900">{row.miles} mi</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setShowPoolAdjust((v) => !v)}
              className="text-sm font-semibold text-orange-600 hover:text-orange-800"
            >
              {showPoolAdjust ? "Hide pool adjust" : "Adjust pool totals"}
            </button>

            {showPoolAdjust ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Base pool</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
                    value={baseLongRunPoolMiles}
                    onChange={(e) => setBaseMiles(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Peak pool</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
                    value={peakLongRunPoolMiles}
                    onChange={(e) => setPeakMiles(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Taper pool</label>
                  <input
                    type="number"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
                    value={taperLongRunPoolMiles}
                    onChange={(e) => setTaperMiles(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveFoundationAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? "Setting up…" : "Set up your workouts"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
            >
              Save & exit
            </button>
          </div>
        </>
      ) : step === "longRun" ? (
        <>
          <p className="text-sm font-medium text-gray-900">Long run — locked miles, shift Saturday order</p>
          <p className="text-sm text-gray-600">
            Miles and weights stay fixed. Reorder which Saturday slot comes first in your 4-week cycle.
          </p>
          {lrOrder.length ? (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {lrOrder.map((pos, idx) => (
                <li key={pos.id} className="flex items-center justify-between gap-2 px-3 py-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Week {idx + 1} slot</span>
                    <span className="ml-2 text-gray-500">
                      weight {pos.distributionWeight}
                      {pos.workout_catalogue?.name ? ` · ${pos.workout_catalogue.name}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveLrPosition(idx, -1)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === lrOrder.length - 1}
                      onClick={() => moveLrPosition(idx, 1)}
                      className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">Long-run rotation loaded from your distance template.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void confirmLongRunAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Continue"}
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      ) : step === "easy" ? (
        <>
          <p className="text-sm font-medium text-gray-900">Easy — locked</p>
          <p className="text-sm text-gray-600">
            Easy fill comes from the GoFast template. Pace uses catalogue offsets plus your adjuster
            on the last step.
          </p>
          {catalogueNames(presetApi?.easyConfig?.positions).length ? (
            <ul className="list-disc pl-5 text-sm text-gray-700">
              {catalogueNames(presetApi?.easyConfig?.positions).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void confirmEasyAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              Continue
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      ) : step === "tempo" ? (
        <>
          <p className="text-sm font-medium text-gray-900">Tempo — catalogue locked</p>
          <p className="text-sm text-gray-600">These threshold workouts rotate from the universal catalogue.</p>
          {catalogueNames(presetApi?.tempoConfig?.positions).length ? (
            <ul className="list-disc pl-5 text-sm text-gray-700">
              {catalogueNames(presetApi?.tempoConfig?.positions).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Template tempo rotation</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void confirmTempoAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              Continue
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      ) : step === "interval" ? (
        <>
          <p className="text-sm font-medium text-gray-900">Interval — catalogue locked</p>
          <p className="text-sm text-gray-600">These interval workouts rotate from the universal catalogue.</p>
          {catalogueNames(presetApi?.intervalsConfig?.positions).length ? (
            <ul className="list-disc pl-5 text-sm text-gray-700">
              {catalogueNames(presetApi?.intervalsConfig?.positions).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Template interval rotation</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void confirmIntervalAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              Continue
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-900">Pace adjuster</p>
          <p className="text-sm text-gray-600">
            Nudge each run type faster (negative) or slower (positive). Generate uses{" "}
            <span className="font-medium">5K + catalogue offset + your adjuster</span>.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["easy", "Easy"],
                ["longRun", "Long run"],
                ["threshold", "Tempo / threshold"],
                ["interval", "Interval"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-gray-700">{label} (sec/mi)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base"
                  value={paceAdjuster[key]}
                  onChange={(e) =>
                    setPaceAdjuster((prev) => ({
                      ...prev,
                      [key]: Number(e.target.value),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveAdjusterAndFinish()}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save preset"}
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

/** @deprecated use AthletePresetBuilder */
export const AthletePresetIngestForm = AthletePresetBuilder;
