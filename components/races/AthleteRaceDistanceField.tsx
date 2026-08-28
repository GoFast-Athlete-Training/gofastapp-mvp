"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { COMMON_RACE_DISTANCE_PRESETS } from "@/lib/training/race-distance-presets";
import { snapDistanceLabelFromMeters } from "@/lib/training/preset-distance-match";
import { metersToMiles } from "@/lib/pace-utils";

export type AthleteRaceDistanceSnapshot = {
  distanceLabel: string | null;
  distanceMeters: number | null;
};

function milesLabel(meters: number): string {
  const mi = metersToMiles(meters);
  return mi >= 10 ? `${mi.toFixed(1)} mi` : `${mi.toFixed(2)} mi`;
}

function displayDistanceLabel(
  distanceLabel: string | null,
  distanceMeters: number | null
): string | null {
  const dl = distanceLabel?.trim();
  if (dl) return dl;
  const snapped = snapDistanceLabelFromMeters(distanceMeters);
  if (snapped) return snapped;
  if (distanceMeters != null && Number.isFinite(Number(distanceMeters))) {
    return milesLabel(Number(distanceMeters));
  }
  return null;
}

function DistancePicker({
  selectValue,
  saving,
  error,
  required,
  showLabel,
  className,
  onChange,
}: {
  selectValue: string;
  saving: boolean;
  error: string | null;
  required?: boolean;
  showLabel?: boolean;
  className?: string;
  onChange: (label: string) => void;
}) {
  const selectedPreset = COMMON_RACE_DISTANCE_PRESETS.find(
    (p) => p.label.toLowerCase() === selectValue.trim().toLowerCase()
  );
  const milesHint = selectedPreset ? milesLabel(selectedPreset.meters) : null;

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {showLabel ? (
        <label className="block text-xs font-medium text-gray-700">
          Confirm the distance you are registered / planning to run
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
      ) : null}
      <select
        value={selectValue}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
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

/** Persist race distance onto athlete_races (working-set canon). */
export function AthleteRaceDistanceField({
  athleteRaceId,
  distanceLabel,
  distanceMeters,
  onSaved,
  required = false,
  variant = "form",
  className = "",
}: {
  athleteRaceId: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  onSaved: (updated: AthleteRaceDistanceSnapshot) => void;
  required?: boolean;
  variant?: "form" | "inline";
  className?: string;
}) {
  const initial =
    distanceLabel?.trim() ||
    COMMON_RACE_DISTANCE_PRESETS.find((p) => p.meters === distanceMeters)?.label ||
    snapDistanceLabelFromMeters(distanceMeters) ||
    "";

  const [selectValue, setSelectValue] = useState(initial);
  const [expanded, setExpanded] = useState(!initial.trim());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelDisplay = useMemo(
    () => displayDistanceLabel(distanceLabel, distanceMeters),
    [distanceLabel, distanceMeters]
  );
  const hasDistance = Boolean(labelDisplay);

  useEffect(() => {
    setSelectValue(initial);
    setExpanded(!initial.trim());
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
      const updated = {
        distanceLabel: data.athleteRace.distanceLabel ?? trimmed,
        distanceMeters: data.athleteRace.distanceMeters ?? preset?.meters ?? null,
      };
      onSaved(updated);
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save distance");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectChange(next: string) {
    setSelectValue(next);
    setError(null);
    if (next.trim()) void saveDistance(next);
  }

  if (variant === "inline") {
    if (hasDistance && !expanded) {
      return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-semibold text-gray-900">
            {labelDisplay}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-semibold text-orange-700 hover:underline"
          >
            Update
          </button>
        </div>
      );
    }

    return (
      <div className={className}>
        {!hasDistance && !expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-semibold text-orange-700 hover:underline"
          >
            Add distance
          </button>
        ) : (
          <DistancePicker
            selectValue={selectValue}
            saving={saving}
            error={error}
            required={required}
            showLabel={false}
            onChange={handleSelectChange}
          />
        )}
        {expanded && hasDistance ? (
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setSelectValue(initial);
              setError(null);
            }}
            className="mt-2 text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <DistancePicker
      selectValue={selectValue}
      saving={saving}
      error={error}
      required={required}
      showLabel
      className={className}
      onChange={handleSelectChange}
    />
  );
}

export function athleteRaceDistanceReady(
  distanceMeters: number | null | undefined
): boolean {
  return distanceMeters != null && Number.isFinite(Number(distanceMeters)) && Number(distanceMeters) > 0;
}
