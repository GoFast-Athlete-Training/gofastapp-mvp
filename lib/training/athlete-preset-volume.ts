import type { AthletePresetFitnessPhase } from "@prisma/client";

export function ageYearsFromBirthday(birthday: Date | null | undefined): number | null {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
}

export function buildTrainingHistoryPrefill(athlete: {
  weeklyMileage?: number | null;
  fiveKPace?: string | null;
  longRunCapabilityMiles?: number | null;
}): string {
  const parts: string[] = [];
  if (athlete.weeklyMileage != null && Number.isFinite(athlete.weeklyMileage)) {
    parts.push(`Running about ${Math.round(athlete.weeklyMileage)} miles per week recently.`);
  }
  if (athlete.fiveKPace?.trim()) {
    parts.push(`5K pace around ${athlete.fiveKPace.trim()}.`);
  }
  if (
    athlete.longRunCapabilityMiles != null &&
    Number.isFinite(athlete.longRunCapabilityMiles)
  ) {
    parts.push(
      `Longest recent long run about ${athlete.longRunCapabilityMiles.toFixed(1)} miles.`
    );
  }
  return parts.join(" ");
}

/** Parse mpw from free text — e.g. "50 mpw", "45 miles per week". */
export function parseWeeklyMileageFromHistory(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const patterns = [
    /\b(\d{2,3})\s*(?:mpw|miles?\s*(?:per|\/)\s*week)\b/i,
    /\b(?:running|run(?:ning)?)\s*(?:about|around|~)?\s*(\d{2,3})\s*miles?\b/i,
    /\b(\d{2,3})\s*miles?\s*(?:a|per)\s*week\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 10 && n <= 120) return Math.round(n);
    }
  }
  return null;
}

/**
 * Weekly mileage for preset infer — profile/history first, then long-run estimate, then phase default.
 * Athletes do not type this on the preset builder; Peak/Base + history carry it.
 */
export function resolveWeeklyMileageForPresetInfer(input: {
  fitnessPhase: AthletePresetFitnessPhase;
  trainingHistory: string;
  profileWeeklyMileage?: number | null;
  longRunCapabilityMiles?: number | null;
  bodyWeeklyMileage?: number | null;
}): number {
  const fromBody = input.bodyWeeklyMileage;
  if (fromBody != null && Number.isFinite(fromBody) && fromBody >= 1) {
    return Math.round(fromBody);
  }
  const fromProfile = input.profileWeeklyMileage;
  if (fromProfile != null && Number.isFinite(fromProfile) && fromProfile >= 1) {
    return Math.round(fromProfile);
  }
  const fromHistory = parseWeeklyMileageFromHistory(input.trainingHistory);
  if (fromHistory != null) return fromHistory;
  const lr = input.longRunCapabilityMiles;
  if (lr != null && Number.isFinite(lr) && lr > 0) {
    return Math.max(20, Math.min(90, Math.round(lr * 2.8)));
  }
  return input.fitnessPhase === "PEAK" ? 48 : 32;
}

/** @deprecated removed — volume comes from OpenAI core infer, not weekly heuristics */
export type AthletePresetVolumeInput = {
  fitnessPhase: AthletePresetFitnessPhase;
  weeklyMileage?: number | null;
};
