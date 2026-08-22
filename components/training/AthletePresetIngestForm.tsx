"use client";

import { useEffect, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";

export type PresetForWizardLite = {
  id: string;
  title: string;
};

export type AthletePresetIngestResult = {
  id: string;
  title: string;
};

type AthleteProfileSnapshot = {
  ageYears: number | null;
  gender: string | null;
  trainingHistoryPrefill: string;
  weeklyMileage: number | null;
};

type AthletePresetIngestFormProps = {
  getToken: () => Promise<string>;
  templatePresets: PresetForWizardLite[];
  raceDistanceMeters: number | null;
  defaultTitle: string;
  onCreated: (preset: AthletePresetIngestResult) => void;
  onCancel: () => void;
};

export function AthletePresetIngestForm({
  getToken,
  templatePresets,
  raceDistanceMeters,
  defaultTitle,
  onCreated,
  onCancel,
}: AthletePresetIngestFormProps) {
  const [profile, setProfile] = useState<AthleteProfileSnapshot | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [title, setTitle] = useState(defaultTitle);
  const [trainingHistory, setTrainingHistory] = useState("");
  const [fitnessPhase, setFitnessPhase] = useState<"PEAK" | "BASE">("PEAK");
  const [sourcePresetId, setSourcePresetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoadingProfile(true);
      try {
        const token = await getToken();
        const res = await fetch("/api/athlete/me", {
          headers: athleteBearerFetchHeaders(token),
        });
        const data = (await res.json()) as {
          athlete?: {
            birthday?: string | null;
            gender?: string | null;
            weeklyMileage?: number | null;
            fiveKPace?: string | null;
            longRunCapabilityMiles?: number | null;
          };
        };
        const a = data.athlete;
        let ageYears: number | null = null;
        if (a?.birthday) {
          const b = new Date(a.birthday);
          if (!Number.isNaN(b.getTime())) {
            const today = new Date();
            ageYears = today.getFullYear() - b.getFullYear();
          }
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
        setProfile({
          ageYears,
          gender: a?.gender?.trim() || null,
          trainingHistoryPrefill: parts.join(" "),
          weeklyMileage: a?.weeklyMileage ?? null,
        });
        setTrainingHistory(parts.join(" "));
      } catch {
        setProfile({
          ageYears: null,
          gender: null,
          trainingHistoryPrefill: "",
          weeklyMileage: null,
        });
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [getToken]);

  useEffect(() => {
    if (sourcePresetId || templatePresets.length === 0) return;
    setSourcePresetId(templatePresets[0]!.id);
  }, [templatePresets, sourcePresetId]);

  async function handleSubmit() {
    if (!sourcePresetId) {
      setError("Pick a GoFast workout template.");
      return;
    }
    if (!title.trim()) {
      setError("Give your blueprint a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/athlete-presets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          title: title.trim(),
          fitnessPhase,
          trainingHistory: trainingHistory.trim(),
          sourcePresetId,
          targetDistanceMeters: raceDistanceMeters,
          weeklyMileage: profile?.weeklyMileage ?? null,
        }),
      });
      const data = (await res.json()) as {
        athletePreset?: AthletePresetIngestResult;
        error?: string;
      };
      if (!res.ok || !data.athletePreset?.id) {
        setError(data.error ?? "Could not save your blueprint");
        return;
      }
      onCreated(data.athletePreset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your blueprint");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-gray-800">
        <p className="font-medium text-gray-900">Create your own blueprint</p>
        <p className="mt-1 text-gray-700">
          We use your profile and recent training — no coach persona wizard.
        </p>
      </div>

      {loadingProfile ? (
        <p className="text-sm text-gray-600">Loading your profile…</p>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">About you</p>
          <p className="mt-1">
            {profile?.ageYears != null ? `${profile.ageYears} years old` : "Age not set"}
            {profile?.gender ? ` · ${profile.gender}` : ""}
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">Blueprint name</label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-800">
          Previous training history
        </label>
        <textarea
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
          value={trainingHistory}
          onChange={(e) => setTrainingHistory(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-800">Where do you feel you are?</p>
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
          GoFast workout template
        </label>
        <select
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base"
          value={sourcePresetId}
          onChange={(e) => setSourcePresetId(e.target.value)}
        >
          {templatePresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-600">
          Workout rotations come from this template; volume comes from your peak/base choice.
        </p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSubmit()}
          className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save blueprint & continue"}
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
