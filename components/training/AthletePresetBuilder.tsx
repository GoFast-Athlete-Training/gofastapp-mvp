"use client";

import { useCallback, useEffect, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { ageYearsFromBirthday } from "@/lib/training/athlete-preset-volume";
import {
  foundationWeeklyBandMeaning,
  foundationWeeklyComparisonRows,
} from "@/lib/training/weekly-volume-key";
import {
  foundationPeakPoolComparisonRows,
  peakLongRunPoolFoundationKey,
} from "@/lib/training/long-run-pool-fields";
import {
  DEFAULT_ATHLETE_PACE_ADJUSTER,
  type AthletePaceAdjuster,
} from "@/lib/training/athlete-pace-adjuster";
import { InlineGoalForm, type InlineGoalRow } from "@/components/races/InlineGoalForm";
import { FoundationCompareExpander } from "@/components/training/FoundationCompareExpander";
import { RotationOrderList } from "@/components/training/RotationOrderList";
import {
  QualityRotationReview,
  catalogueIdsFromQualitySlots,
  qualitySlotsHaveCatalogue,
  type QualityRotationSlot,
} from "@/components/training/QualityRotationReview";
import { QualityCataloguePicker } from "@/components/training/QualityCataloguePicker";
import {
  builderProgressFromOverview,
  qualityStepSubPhase,
} from "@/lib/training/athlete-preset-builder-progress";

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
  workout_catalogue?: { name: string; description?: string | null; workoutType: string } | null;
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
  progressionAggressiveness: string | null;
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

type GoalIntentMode = "unset" | "time" | "fun";

function formatRaceWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type AthletePresetBuilderProps = {
  getToken: () => Promise<string>;
  templatePresets: PresetForWizardLite[];
  resumePresetId?: string | null;
  athleteRaceId: string;
  goalRecordId: string | null;
  raceDistanceMeters: number | null;
  raceDistanceLabel: string | null;
  raceName: string;
  raceDate: string;
  planStartDate: string;
  goalTime: string | null;
  onGoalTimeSaved?: (updated: InlineGoalRow) => void;
  onComplete: (preset: AthletePresetIngestResult) => void;
  onCancel: () => void;
};

type BuilderStep =
  | "intro"
  | "foundation"
  | "longRun"
  | "tempo"
  | "interval"
  | "adjuster";

function buildStepToUi(step: AthletePresetApi["buildStep"]): BuilderStep {
  if (step === "core") return "foundation";
  if (step === "complete") return "adjuster";
  if (step === "easy") return "tempo";
  return step;
}

function weightPercent(weight: number): string {
  return `${Math.round(weight * 100)}% of cycle miles`;
}

function sortedQualitySlots(positions: ConfigPosition[] | undefined): QualityRotationSlot[] {
  return [...(positions ?? [])]
    .sort((a, b) => a.cyclePosition - b.cyclePosition)
    .map((p) => ({
      id: p.id,
      cyclePosition: p.cyclePosition,
      catalogueWorkoutId: p.catalogueWorkoutId,
      workout_catalogue: p.workout_catalogue,
    }));
}

function reorderQualitySlots(slots: QualityRotationSlot[], orderedIds: string[]): QualityRotationSlot[] {
  const byId = new Map(slots.map((s) => [s.id, s]));
  return orderedIds
    .map((id, idx) => {
      const slot = byId.get(id);
      if (!slot) return null;
      return { ...slot, cyclePosition: idx + 1 };
    })
    .filter((s): s is QualityRotationSlot => s != null);
}

export function AthletePresetBuilder({
  getToken,
  templatePresets,
  resumePresetId,
  athleteRaceId,
  goalRecordId,
  raceDistanceMeters,
  raceDistanceLabel,
  raceName,
  raceDate,
  planStartDate,
  goalTime: goalTimeProp,
  onGoalTimeSaved,
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
  const [tempoOrder, setTempoOrder] = useState<QualityRotationSlot[]>([]);
  const [intervalOrder, setIntervalOrder] = useState<QualityRotationSlot[]>([]);
  const [tempoTemplateSeedIds, setTempoTemplateSeedIds] = useState<string[]>([]);
  const [intervalTemplateSeedIds, setIntervalTemplateSeedIds] = useState<string[]>([]);
  const [paceAdjuster, setPaceAdjuster] = useState<AthletePaceAdjuster>({
    ...DEFAULT_ATHLETE_PACE_ADJUSTER,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectiveGoalTime, setEffectiveGoalTime] = useState<string | null>(
    goalTimeProp?.trim() || null
  );
  const [goalIntentMode, setGoalIntentMode] = useState<GoalIntentMode>(() =>
    goalTimeProp?.trim() ? "time" : "unset"
  );
  const [goalIntentConfirmed, setGoalIntentConfirmed] = useState(false);

  useEffect(() => {
    const t = goalTimeProp?.trim() || null;
    setEffectiveGoalTime(t);
    if (t) {
      setGoalIntentMode("time");
      setGoalIntentConfirmed(false);
    }
  }, [goalTimeProp]);

  function selectGoalTimeMode() {
    setGoalIntentMode("time");
    setGoalIntentConfirmed(false);
    setError(null);
  }

  function selectRacingForFunMode() {
    setGoalIntentMode("fun");
    setGoalIntentConfirmed(false);
    setError(null);
  }

  function handleGoalSaved(updated: InlineGoalRow) {
    const gt = updated.goalTime?.trim() || null;
    setEffectiveGoalTime(gt);
    setGoalIntentMode("time");
    setGoalIntentConfirmed(false);
    onGoalTimeSaved?.(updated);
  }

  const racingForFun = goalIntentMode === "fun" && goalIntentConfirmed;
  const inferGoalTime = racingForFun ? null : effectiveGoalTime;

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
      const tempoSlots = sortedQualitySlots(ap.tempoConfig?.positions);
      const intervalSlots = sortedQualitySlots(ap.intervalsConfig?.positions);
      setTempoOrder(tempoSlots);
      setIntervalOrder(intervalSlots);
      setTempoTemplateSeedIds(catalogueIdsFromQualitySlots(tempoSlots));
      setIntervalTemplateSeedIds(catalogueIdsFromQualitySlots(intervalSlots));

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
    if (!goalIntentConfirmed) {
      setError("Confirm your race goal — finish time or just racing for fun — before continuing.");
      return;
    }
    if (goalIntentMode === "time" && !effectiveGoalTime) {
      setError("Set a finish goal time, or choose just racing for fun.");
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
          goalTime: inferGoalTime,
          racingForFun,
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
    setTempoOrder(sortedQualitySlots(data.athletePreset.tempoConfig?.positions));
    setIntervalOrder(sortedQualitySlots(data.athletePreset.intervalsConfig?.positions));
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
            goalTime: inferGoalTime,
            racingForFun,
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
      const tempoSlots = sortedQualitySlots(setupData.athletePreset.tempoConfig?.positions);
      const intervalSlots = sortedQualitySlots(setupData.athletePreset.intervalsConfig?.positions);
      setTempoOrder(tempoSlots);
      setIntervalOrder(intervalSlots);
      setTempoTemplateSeedIds(catalogueIdsFromQualitySlots(tempoSlots));
      setIntervalTemplateSeedIds(catalogueIdsFromQualitySlots(intervalSlots));
      setStep("longRun");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save foundation");
    } finally {
      setSaving(false);
    }
  }

  function reorderLr(ids: string[]) {
    const byId = new Map(lrOrder.map((p) => [p.id, p]));
    setLrOrder(ids.map((id) => byId.get(id)!).filter(Boolean));
  }

  function reorderTempo(ids: string[]) {
    setTempoOrder((prev) => reorderQualitySlots(prev, ids));
  }

  function reorderInterval(ids: string[]) {
    setIntervalOrder((prev) => reorderQualitySlots(prev, ids));
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
      setStep("tempo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save long run order");
    } finally {
      setSaving(false);
    }
  }

  async function confirmTempoPick(selectedIds: string[]) {
    setSaving(true);
    setError(null);
    try {
      await patchPreset({
        step: "tempo",
        action: "saveSelection",
        orderedCatalogueWorkoutIds: selectedIds,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save tempo workouts");
    } finally {
      setSaving(false);
    }
  }

  async function confirmTempoOrderAndContinue() {
    setSaving(true);
    setError(null);
    try {
      const ids = catalogueIdsFromQualitySlots(tempoOrder);
      if (ids.length > 0) {
        await patchPreset({
          step: "tempo",
          action: "saveSelection",
          orderedCatalogueWorkoutIds: ids,
        });
      }
      await patchPreset({ step: "tempo", action: "confirm" });
      setStep("interval");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save tempo rotation");
    } finally {
      setSaving(false);
    }
  }

  async function confirmIntervalPick(selectedIds: string[]) {
    setSaving(true);
    setError(null);
    try {
      await patchPreset({
        step: "interval",
        action: "saveSelection",
        orderedCatalogueWorkoutIds: selectedIds,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save interval workouts");
    } finally {
      setSaving(false);
    }
  }

  async function confirmIntervalOrderAndContinue() {
    setSaving(true);
    setError(null);
    try {
      const ids = catalogueIdsFromQualitySlots(intervalOrder);
      if (ids.length > 0) {
        await patchPreset({
          step: "interval",
          action: "saveSelection",
          orderedCatalogueWorkoutIds: ids,
        });
      }
      await patchPreset({ step: "interval", action: "confirm" });
      setStep("adjuster");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save interval rotation");
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

  const peakDate =
    corePreview?.peakLongRunDate ?? corePreview?.calendar.peakLongRunDate ?? null;
  const taperDate =
    corePreview?.taperStartDate ?? corePreview?.calendar.taperStartDate ?? null;
  const weeklyBand = corePreview?.weeklyVolumeBand;
  const peakPoolKeyLine = peakLongRunPoolMiles
    ? peakLongRunPoolFoundationKey(Number(peakLongRunPoolMiles))
    : null;
  const weeklyKeyLine = weeklyBand
    ? foundationWeeklyBandMeaning(weeklyBand)
    : null;

  const builderProgress = builderProgressFromOverview(presetApi?.coachPlanOverview);
  const tempoSubPhase = step === "tempo" ? qualityStepSubPhase(builderProgress, "tempo") : "pick";
  const intervalSubPhase =
    step === "interval" ? qualityStepSubPhase(builderProgress, "interval") : "pick";
  const progressionAggressiveness =
    corePreview?.progressionAggressiveness ??
    (typeof presetApi?.progressionAggressiveness === "string"
      ? presetApi.progressionAggressiveness
      : "MODERATE");

  const weeklyCompareRows = foundationWeeklyComparisonRows({
    raceDistanceLabel,
    selectedBand: weeklyBand ?? null,
  });
  const peakPoolCompareRows = peakLongRunPoolMiles
    ? foundationPeakPoolComparisonRows(Number(peakLongRunPoolMiles))
    : [];

  return (
    <div className="space-y-4">
      {step === "intro" && !loadingProfile ? (
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-gray-800">
          <p className="font-medium text-gray-900">Create your preset</p>
          <p className="mt-1 text-gray-700">
            Tell us your history and race goal — we&apos;ll infer your weekly range and long-run
            pool, then confirm your long run, tempo, and interval rotations.
          </p>
        </div>
      ) : null}

      {loadingProfile ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : step === "intro" ? (
        <>
          <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4">
            <p className="text-sm font-medium text-gray-900">Your race goal</p>
            <p className="mt-1 text-sm text-gray-700">
              <span className="font-medium text-gray-900">{raceName}</span> —{" "}
              {formatRaceWhen(raceDate)}
              {raceDistanceLabel ? ` · ${raceDistanceLabel}` : ""}
            </p>
            <p className="mt-2 text-xs text-gray-600">
              This drives your weekly min–max mileage band — confirm before we analyze your training.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectGoalTimeMode}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  goalIntentMode === "time"
                    ? "bg-orange-600 text-white"
                    : "border border-gray-300 bg-white text-gray-800"
                }`}
              >
                I have a finish goal
              </button>
              <button
                type="button"
                onClick={selectRacingForFunMode}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  goalIntentMode === "fun"
                    ? "bg-orange-600 text-white"
                    : "border border-gray-300 bg-white text-gray-800"
                }`}
              >
                Just racing for fun
              </button>
            </div>

            {goalIntentMode === "time" ? (
              <div className="mt-4 space-y-3">
                {effectiveGoalTime && goalIntentConfirmed ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-sm font-mono font-semibold text-gray-900">
                      Goal {effectiveGoalTime}
                    </span>
                    <button
                      type="button"
                      onClick={() => setGoalIntentConfirmed(false)}
                      className="text-sm font-semibold text-orange-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : effectiveGoalTime ? (
                  <div className="space-y-2">
                    <span className="inline-flex items-center rounded-full border border-orange-200 bg-white px-3 py-1 text-sm font-mono font-semibold text-gray-900">
                      Goal {effectiveGoalTime}
                    </span>
                    <p className="text-sm text-gray-700">Is this the finish time we should plan around?</p>
                    <button
                      type="button"
                      onClick={() => setGoalIntentConfirmed(true)}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                    >
                      Yes — that&apos;s my goal
                    </button>
                    <button
                      type="button"
                      onClick={() => setEffectiveGoalTime(null)}
                      className="ml-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      Update time
                    </button>
                  </div>
                ) : (
                  <InlineGoalForm
                    race={{
                      athleteRaceId,
                      name: raceName,
                      raceDate,
                      distanceLabel: raceDistanceLabel,
                      distanceMeters: raceDistanceMeters,
                    }}
                    goal={
                      goalRecordId
                        ? {
                            id: goalRecordId,
                            goalTime: effectiveGoalTime,
                            athleteRaceId,
                          }
                        : null
                    }
                    onSaved={handleGoalSaved}
                  />
                )}
              </div>
            ) : null}

            {goalIntentMode === "fun" ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-gray-700">
                  No clock pressure — we&apos;ll size a finish-focused weekly band and long-run pool
                  from your history.
                </p>
                {goalIntentConfirmed ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
                      Just racing for fun
                    </span>
                    <button
                      type="button"
                      onClick={() => setGoalIntentConfirmed(false)}
                      className="text-sm font-semibold text-orange-700 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setGoalIntentConfirmed(true)}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                  >
                    Yes — just racing for fun
                  </button>
                )}
              </div>
            ) : null}
          </div>

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
              disabled={saving || !goalIntentConfirmed}
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
              <p className="text-lg font-semibold text-gray-900">Your Core</p>
              <p className="mt-2 text-sm text-gray-700">We calculated two key metrics.</p>
            </div>

            {corePreview?.weSeeYou ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-gray-800">
                <p className="font-medium text-gray-900">{corePreview.weSeeYou}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">Weekly Mileage</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {minWeeklyMiles || corePreview?.minWeeklyMiles || "—"}–
                  {maxWeeklyMiles ?? corePreview?.maxWeeklyMiles ?? "—"} mi
                </p>
                {weeklyKeyLine ? (
                  <p className="mt-1 text-xs text-gray-600">{weeklyKeyLine}</p>
                ) : null}
                <FoundationCompareExpander
                  label="See how this weekly mileage compares"
                  rows={weeklyCompareRows}
                />
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">Long Cycle Pool Peak</p>
                <p className="mt-2 text-sm text-gray-700">
                  This is the sum of our 4-cycle long-run system. We work off of a long-long-long-cutback
                  model.
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Cycle pool total
                </p>
                <p className="mt-1 text-lg font-bold text-orange-600">
                  {peakLongRunPoolMiles || "—"} mi
                </p>
                {peakPoolKeyLine ? (
                  <p className="mt-1 text-xs font-medium text-orange-800">{peakPoolKeyLine}</p>
                ) : null}
                {peakPoolCompareRows.length ? (
                  <FoundationCompareExpander
                    label="See how this peak mileage compares"
                    rows={peakPoolCompareRows}
                  />
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Peak date</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{peakDate ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Taper date</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{taperDate ?? "—"}</p>
              </div>
            </div>

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
          <p className="text-sm font-medium text-gray-900">Your four-week long-run cycle</p>
          <p className="text-sm text-gray-600">
            All four sessions stay in your cycle — drag or use Earlier/Later to choose which Saturday
            slot comes first.
          </p>
          <RotationOrderList
            items={lrOrder.map((pos) => ({
              id: pos.id,
              title: pos.workout_catalogue?.name ?? "Long run",
              subtitle: weightPercent(pos.distributionWeight),
            }))}
            onReorder={reorderLr}
          />
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
      ) : step === "tempo" ? (
        <>
          {tempoSubPhase === "pick" ? (
            <>
              <p className="text-sm font-medium text-gray-900">Select tempo workouts</p>
              <QualityCataloguePicker
                presetId={presetId!}
                workoutType="Tempo"
                templateSeedIds={tempoTemplateSeedIds}
                weeklyVolumeBand={weeklyBand ?? null}
                progressionAggressiveness={progressionAggressiveness}
                getToken={getToken}
                saving={saving}
                onContinue={(ids) => void confirmTempoPick(ids)}
              />
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900">Your tempo rotation</p>
              <p className="text-sm text-gray-600">
                Drag or use Earlier/Later to set the order these {tempoOrder.length} tempo workouts
                rotate through your plan.
              </p>
              {qualitySlotsHaveCatalogue(tempoOrder) ? (
                <QualityRotationReview
                  slots={tempoOrder}
                  onReorder={reorderTempo}
                  slotLabel={(i) => `Rotation ${i + 1}`}
                />
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No tempo workouts selected yet.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !qualitySlotsHaveCatalogue(tempoOrder)}
                  onClick={() => void confirmTempoOrderAndContinue()}
                  className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Continue"}
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
          )}
          {tempoSubPhase === "pick" ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
            >
              Save & exit
            </button>
          ) : null}
        </>
      ) : step === "interval" ? (
        <>
          {intervalSubPhase === "pick" ? (
            <>
              <p className="text-sm font-medium text-gray-900">Select interval workouts</p>
              <QualityCataloguePicker
                presetId={presetId!}
                workoutType="Intervals"
                templateSeedIds={intervalTemplateSeedIds}
                weeklyVolumeBand={weeklyBand ?? null}
                progressionAggressiveness={progressionAggressiveness}
                getToken={getToken}
                saving={saving}
                onContinue={(ids) => void confirmIntervalPick(ids)}
              />
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900">Your interval rotation</p>
              <p className="text-sm text-gray-600">
                Drag or use Earlier/Later to set the order these {intervalOrder.length} interval
                workouts rotate through your plan.
              </p>
              {qualitySlotsHaveCatalogue(intervalOrder) ? (
                <QualityRotationReview
                  slots={intervalOrder}
                  onReorder={reorderInterval}
                  slotLabel={(i) => `Rotation ${i + 1}`}
                />
              ) : (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No interval workouts selected yet.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !qualitySlotsHaveCatalogue(intervalOrder)}
                  onClick={() => void confirmIntervalOrderAndContinue()}
                  className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Continue"}
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
          )}
          {intervalSubPhase === "pick" ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
            >
              Save & exit
            </button>
          ) : null}
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
