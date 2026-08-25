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

/** @deprecated removed — volume comes from OpenAI core infer, not weekly heuristics */
export type AthletePresetVolumeInput = {
  fitnessPhase: AthletePresetFitnessPhase;
  weeklyMileage?: number | null;
};
