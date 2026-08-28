"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { COMMON_RACE_DISTANCE_PRESETS } from "@/lib/training/race-distance-presets";
import { metersToMiles } from "@/lib/pace-utils";

export type AthleteRaceDistanceSnapshot = {
  distanceLabel: string | null;
  distanceMeters: number | null;
};

function milesLabel(meters: number): string {
  const mi = metersToMiles(meters);
  return mi >= 10 ? `${mi.toFixed(1)} mi` : `${mi.toFixed(2)} mi`;
}

/** Persist race distance onto athlete_races (working-set canon). */
export function AthleteRaceDistanceField({
  athleteRaceId,
  distanceLabel,
  distanceMeters,
  onSaved,
  required = false,
}: {
  athleteRaceId: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  onSaved: (updated: AthleteRaceDistanceSnapshot) => void;
  required?: boolean;
}) {
  const initial =
    distanceLabel?.trim() ||
    COMMON_RACE_DISTANCE_PRESETS.find((p) => p.meters === distanceMeters)?.label ||
    "";

  const [selectValue, setSelectValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectValue(initial);
  }, [athleteRaceId, initial]);

  async function saveDistance(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    try {
      const preset = COMMON_RACE_DISTANCE_PRESETS.find(
        (p) => p.label.toLowerCase() === trimmed.toLowerCase()
      );
      const { data } = await api.patch<{
        athleteRace?: {
          distanceLabel?: string | null;
          distanceMeters?: number | null;
        };
        error?: string;
      }>(`/athlete-races/${encodeURIComponent(athleteRaceId)}`, {
        distanceLabel: trimmed,
        ...(preset ? { distanceMeters: preset.meters } : {}),
      });
      if (data.error || !data.athleteRace) {
        throw new Error(data.error ?? "Could not save distance");
      }
      onSaved({
        distanceLabel: data.athleteRace.distanceLabel ?? trimmed,
        distanceMeters: data.athleteRace.distanceMeters ?? preset?.meters ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save distance");
    } finally {
      setSaving(false);
    }
  }

  const selectedPreset = COMMON_RACE_DISTANCE_PRESETS.find(
    (p) => p.label.toLowerCase() === selectValue.trim().toLowerCase()
  );
  const milesHint = selectedPreset ? milesLabel(selectedPreset.meters) : null;

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700">
        How far are you racing?
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <select
        value={selectValue}
        disabled={saving}
        onChange={(e) => {
          const next = e.target.value;
          setSelectValue(next);
          setError(null);
          if (next.trim()) void saveDistance(next);
        }}
        className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-60"
      >
        <option value="">Choose distance…</option>
        {COMMON_RACE_DISTANCE_PRESETS.map((p) => (
          <option key={p.label} value={p.label}>
            {p.label}
          </option>
        ))}
      </select>
      {milesHint ? <p className="text-xs text-gray-600">{milesHint}</p> : null}
      {saving ? <p className="text-xs text-gray-500">Saving…</p> : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

export function athleteRaceDistanceReady(
  distanceMeters: number | null | undefined
): boolean {
  return distanceMeters != null && Number.isFinite(Number(distanceMeters)) && Number(distanceMeters) > 0;
}
