"use client";

import { useCallback, useEffect, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { ageYearsFromBirthday } from "@/lib/training/athlete-preset-volume";

export type PresetForWizardLite = {
  id: string;
  title: string;
};

export type AthletePresetIngestResult = {
  id: string;
  title: string;
};

type AthletePresetApi = AthletePresetIngestResult & {
  buildStep: "core" | "workouts" | "rotations" | "pace" | "complete";
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
  paceProfile: unknown;
};

type CorePreview = {
  weSeeYou: string;
  barriers: string[];
  progressionAggressiveness: string;
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

type BuilderStep = "intro" | "core-results" | "workouts" | "rotations" | "pace";

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
  const [corePreview, setCorePreview] = useState<CorePreview | null>(null);
  const [showPoolAdjust, setShowPoolAdjust] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrateFromPreset = useCallback((ap: AthletePresetApi) => {
    setPresetId(ap.id);
    setTitle(ap.title);
    setDescription(ap.description ?? "");
    setTrainingHistory(ap.trainingHistory ?? "");
    setFitnessPhase(ap.fitnessPhase);
    setBaseMiles(String(ap.baseLongRunPoolMiles));
    setPeakMiles(String(ap.peakLongRunPoolMiles));
    setTaperMiles(String(ap.taperLongRunPoolMiles));
    setMinWeeklyMiles(String(ap.minWeeklyMiles));
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
      setStep("core-results");
    } else if (ap.buildStep === "workouts") setStep("workouts");
    else if (ap.buildStep === "rotations") setStep("rotations");
    else if (ap.buildStep === "pace") setStep("pace");
    else if (ap.isComplete) onComplete({ id: ap.id, title: ap.title });
  }, [onComplete]);

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
          const apData = (await apRes.json()) as { athletePreset?: AthletePresetApi; error?: string };
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
    if (presetId) {
      setStep("core-results");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await ensureBirthdaySaved(token);
      await ensureLongRunCapabilitySaved(token);

      const lrBody =
        longRunCapabilityMiles.trim() && Number(longRunCapabilityMiles) > 0
          ? { longRunCapabilityMiles: Number(longRunCapabilityMiles) }
          : {};

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
          ...lrBody,
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
      if (data.corePreview) setCorePreview(data.corePreview);
      setShowPoolAdjust(false);
      setStep("core-results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze your training");
    } finally {
      setSaving(false);
    }
  }

  async function patchPreset(body: Record<string, unknown>) {
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
    return data.athletePreset;
  }

  async function saveCoreAndContinue() {
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
      };

      if (presetId) {
        await patchPreset({
          step: "core",
          action: "confirmCups",
          ...cupPayload,
        });
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
            longRunCapabilityMiles:
              longRunCapabilityMiles.trim() && Number(longRunCapabilityMiles) > 0
                ? Number(longRunCapabilityMiles)
                : undefined,
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
        setPresetId(data.athletePreset.id);
      }
      setStep("workouts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save cups");
    } finally {
      setSaving(false);
    }
  }

  async function seedWorkoutsAndContinue() {
    setSaving(true);
    setError(null);
    try {
      const ap = await patchPreset({ step: "workouts", action: "seedFromSource" });
      const structure = ap.workoutStructure as { weeklyRunCount?: number; slots?: { workoutType: string; sessionsPerWeek: number }[] } | null;
      if (structure?.slots?.length) {
        const lines = structure.slots
          .filter((s) => s.sessionsPerWeek > 0)
          .map((s) => `${s.workoutType}: ${s.sessionsPerWeek}/week`);
        setWorkoutSummary(lines.join(" · "));
      } else {
        setWorkoutSummary("Weekly workout mix copied from your GoFast distance template.");
      }
      setStep("rotations");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workouts");
    } finally {
      setSaving(false);
    }
  }

  async function cloneRotationsAndContinue() {
    setSaving(true);
    setError(null);
    try {
      await patchPreset({ step: "rotations", action: "cloneFromSource" });
      setStep("pace");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save rotations");
    } finally {
      setSaving(false);
    }
  }

  async function savePaceAndFinish() {
    setSaving(true);
    setError(null);
    try {
      const ap = await patchPreset({ step: "pace", action: "defaultPace" });
      if (ap.isComplete) {
        onComplete({ id: ap.id, title: ap.title });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save pace profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {step === "intro" && !loadingProfile ? (
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-gray-800">
          <p className="text-gray-700">
            Tell us your history and goal race context — we&apos;ll infer your peak long-run pool and
            weekly range.
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
            <p className="mb-2 text-xs text-gray-500">
              Peak vs base plus your history — we infer weekly volume from that, not a separate
              mileage box.
            </p>
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
            <p className="mt-1 text-xs text-gray-500">
              Your current longest Saturday — we ramp the long-run pool from here.
            </p>
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
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              ← Back
            </button>
          </div>
          {saving ? (
            <p className="text-sm text-gray-600">
              Hold on — we&apos;re sizing your peak long-run pool from your history…
            </p>
          ) : null}
        </>
      ) : step === "core-results" ? (
        <>
          {corePreview ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-gray-800">
                <p className="font-medium text-gray-900">{corePreview.weSeeYou}</p>
                {corePreview.barriers.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-gray-700">
                    {corePreview.barriers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="rounded-xl border border-sky-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">Peak long-run pool</p>
                <p className="mt-1 text-2xl font-bold text-orange-600">
                  {peakLongRunPoolMiles || corePreview.calendar.poolMilesByCycle.slice(-2, -1)[0] || "—"}{" "}
                  <span className="text-base font-medium text-gray-600">mi total</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Sum of four Saturday long runs in your peak block — not weekly mileage.
                </p>

                {(corePreview.peakPoolKey ?? corePreview.calendar.peakPoolKey)?.length ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Pool key — 4 Saturdays
                    </p>
                    <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                      {(corePreview.peakPoolKey ?? corePreview.calendar.peakPoolKey)!.map((row) => (
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
                    {(corePreview.peakLongRunDate ?? corePreview.calendar.peakLongRunDate) ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Peak Saturday{" "}
                        {corePreview.peakLongRunDate ?? corePreview.calendar.peakLongRunDate}
                        {(corePreview.taperStartDate ?? corePreview.calendar.taperStartDate)
                          ? ` · Taper starts ${corePreview.taperStartDate ?? corePreview.calendar.taperStartDate}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}
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
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveCoreAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Looks good — continue"}
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      ) : step === "workouts" ? (
        <>
          <p className="text-sm text-gray-700">
            Next we&apos;ll copy the weekly workout mix from your distance template. You can refine
            rotations on the following step.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void seedWorkoutsAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? "Loading…" : "Continue to workouts"}
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      ) : step === "rotations" ? (
        <>
          {workoutSummary ? (
            <p className="text-sm text-gray-700">{workoutSummary}</p>
          ) : null}
          <p className="text-sm text-gray-700">
            We&apos;ll create your personal rotation configs from the GoFast template for this
            distance.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void cloneRotationsAndContinue()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving ? "Building rotations…" : "Confirm rotations"}
            </button>
            <button type="button" onClick={onCancel} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800">
              Save & exit
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-700">
            Last step: we&apos;ll set pace keys anchored to your 5K and goal race pace.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void savePaceAndFinish()}
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
