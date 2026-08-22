import type { AthletePresetFitnessPhase } from "@prisma/client";

export type AthletePresetVolumeInput = {
  fitnessPhase: AthletePresetFitnessPhase;
  weeklyMileage?: number | null;
};

export function computeAthletePresetVolume(input: AthletePresetVolumeInput): {
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
} {
  const weekly =
    typeof input.weeklyMileage === "number" && Number.isFinite(input.weeklyMileage)
      ? Math.round(input.weeklyMileage)
      : null;

  if (input.fitnessPhase === "PEAK") {
    const peak = weekly != null ? Math.max(35, Math.min(70, weekly + 5)) : 55;
    const base = Math.max(25, Math.round(peak * 0.65));
    const taper = Math.max(20, Math.round(peak * 0.55));
    return {
      baseMiles: base,
      peakMiles: peak,
      taperMiles: taper,
      minWeeklyMiles: Math.max(25, base),
      maxWeeklyMiles: peak,
    };
  }

  const base = weekly != null ? Math.max(30, Math.min(60, weekly)) : 45;
  const peak = Math.max(base + 5, Math.round(base * 1.15));
  const taper = Math.max(25, Math.round(base * 0.75));
  return {
    baseMiles: base,
    peakMiles: peak,
    taperMiles: taper,
    minWeeklyMiles: Math.max(25, base),
    maxWeeklyMiles: peak,
  };
}

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
