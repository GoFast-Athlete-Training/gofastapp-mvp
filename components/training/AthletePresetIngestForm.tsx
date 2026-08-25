"use client";

import { useEffect, useState } from "react";
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

type CorePreview = {
  weSeeYou: string;
  barriers: string[];
  progressionAggressiveness: string;
  calendar: {
    totalWeeks: number;
    totalCycles: number;
    poolMilesByCycle: number[];
    peakWeekNumber: number | null;
    taperStartWeekNumber: number;
    longRunCycleWeeks: number;
  };
};

type AthletePresetIngestFormProps = {
  getToken: () => Promise<string>;
  templatePresets: PresetForWizardLite[];
  raceDistanceMeters: number | null;
  raceName: string;
  raceDate: string;
  planStartDate: string;
  goalTime: string | null;
  defaultTitle: string;
  onCreated: (preset: AthletePresetIngestResult) => void;
  onCancel: () => void;
};

export function AthletePresetIngestForm({
  getToken,
  templatePresets,
  raceDistanceMeters,
  raceName,
  raceDate,
  planStartDate,
  goalTime,
  defaultTitle,
  onCreated,
  onCancel,
}: AthletePresetIngestFormProps) {
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [trainingHistory, setTrainingHistory] = useState("");
  const [fitnessPhase, setFitnessPhase] = useState<"PEAK" | "BASE">("PEAK");
  const [weeklyMileage, setWeeklyMileage] = useState("");
  const [birthdayInput, setBirthdayInput] = useState("");
  const [ageYears, setAgeYears] = useState<number | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [needsBirthday, setNeedsBirthday] = useState(false);
  const [corePreview, setCorePreview] = useState<CorePreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (a?.birthday) {
          setBirthdayInput(a.birthday.slice(0, 10));
        }

        const parts: string[] = [];
        if (a?.weeklyMileage != null && Number.isFinite(a.weeklyMileage)) {
          setWeeklyMileage(String(Math.round(a.weeklyMileage)));
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
        setTrainingHistory(parts.join(" "));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load profile");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [getToken]);

  async function ensureBirthdaySaved(token: string): Promise<void> {
    if (!needsBirthday || !birthdayInput.trim() || !athleteId) return;
    const res = await fetch(`/api/athlete/${athleteId}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...athleteBearerFetchHeaders(token),
      },
      body: JSON.stringify({ birthday: birthdayInput }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Could not save birthday");
    }
    setAgeYears(ageYearsFromBirthday(new Date(birthdayInput)));
    setNeedsBirthday(false);
  }

  async function ensureWeeklyMileageSaved(token: string, miles: number): Promise<void> {
    if (!athleteId) return;
    const res = await fetch(`/api/athlete/${athleteId}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...athleteBearerFetchHeaders(token),
      },
      body: JSON.stringify({ weeklyMileage: miles }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Could not save weekly mileage");
    }
  }

  async function handleSubmit() {
    const sourcePresetId = templatePresets[0]?.id;
    if (!sourcePresetId) {
      setError("No GoFast rotation stub for this race distance.");
      return;
    }
    if (!title.trim()) {
      setError("Name your preset.");
      return;
    }
    const miles = Number(weeklyMileage);
    if (!Number.isFinite(miles) || miles < 1) {
      setError("Weekly mileage is required.");
      return;
    }
    if (needsBirthday && !birthdayInput.trim()) {
      setError("Add your birthday so we can size your training.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await ensureBirthdaySaved(token);
      await ensureWeeklyMileageSaved(token, Math.round(miles));

      const res = await fetch("/api/athlete-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          fitnessPhase,
          trainingHistory: trainingHistory.trim(),
          sourcePresetId,
          targetDistanceMeters: raceDistanceMeters,
          weeklyMileage: Math.round(miles),
          raceName,
          raceDate,
          planStartDate,
          goalTime,
        }),
      });
      const data = (await res.json()) as {
        athletePreset?: AthletePresetIngestResult;
        corePreview?: CorePreview;
        error?: string;
      };
      if (!res.ok || !data.athletePreset?.id) {
        setError(data.error ?? "Could not save your preset");
        return;
      }
      if (data.corePreview) {
        setCorePreview(data.corePreview);
      }
      onCreated(data.athletePreset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your preset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-gray-800">
        <p className="font-medium text-gray-900">Create my own</p>
        <p className="mt-1 text-gray-700">
          Tell us who you are and where you are in training. We infer volume from your words — no
          persona wizard.
        </p>
      </div>

      {loadingProfile ? (
        <p className="text-sm text-gray-600">Loading your profile…</p>
      ) : (
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
              placeholder="So you remember"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">Optional — just for you, not sent to the coach AI.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Who am I — your training history
            </label>
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
              <button
                type="button"
                onClick={() => setFitnessPhase("PEAK")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  fitnessPhase === "PEAK"
                    ? "bg-orange-600 text-white"
                    : "border border-gray-300 bg-white text-gray-800"
                }`}
              >
                Peak — already built up
              </button>
              <button
                type="button"
                onClick={() => setFitnessPhase("BASE")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  fitnessPhase === "BASE"
                    ? "bg-orange-600 text-white"
                    : "border border-gray-300 bg-white text-gray-800"
                }`}
              >
                Base — building up
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-800">
              Weekly mileage (required)
            </label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
              value={weeklyMileage}
              onChange={(e) => setWeeklyMileage(e.target.value)}
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

          {corePreview ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-gray-800">
              <p className="font-medium text-gray-900">{corePreview.weSeeYou}</p>
              {corePreview.barriers.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-gray-700">
                  {corePreview.barriers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-gray-700">
                {corePreview.calendar.totalCycles} long-run blocks · peak week{" "}
                {corePreview.calendar.peakWeekNumber ?? "—"} · taper starts week{" "}
                {corePreview.calendar.taperStartWeekNumber}
              </p>
            </div>
          ) : null}
        </>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || loadingProfile}
          onClick={() => void handleSubmit()}
          className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {saving ? "Building your preset…" : "Save preset & continue"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
