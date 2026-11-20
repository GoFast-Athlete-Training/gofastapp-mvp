import { prisma } from "@/lib/prisma";
import { formatPaceMinSec } from "@/lib/training/goal-pace-calculator";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";

const MIN_FIVE_K_SEC = 3 * 60;
const MAX_FIVE_K_SEC = 20 * 60;

function canonicalMilePace(
  raw: unknown,
  label: string,
): { ok: true; pace: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, error: `Enter a ${label} like 7:30` };
  }
  let seconds: number;
  try {
    seconds = parsePaceToSecondsPerMile(raw);
  } catch {
    return { ok: false, error: `Enter a ${label} like 7:30` };
  }
  if (seconds < MIN_FIVE_K_SEC || seconds > MAX_FIVE_K_SEC) {
    return { ok: false, error: `${label} must be between 3:00 and 20:00 per mile` };
  }
  return { ok: true, pace: formatPaceMinSec(seconds) };
}

export function canonicalFiveKPace(
  raw: unknown,
): { ok: true; pace: string } | { ok: false; error: string } {
  return canonicalMilePace(raw, "5K pace");
}

export function canonicalOptionalMilePace(
  raw: unknown,
  label: string,
): { ok: true; pace: string | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, pace: null };
  if (typeof raw !== "string") return { ok: false, error: `Enter a ${label} like 7:30` };
  if (raw.trim() === "") return { ok: true, pace: null };
  return canonicalMilePace(raw, label);
}

function paceOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function loadCompanyPlanAthlete(planId: string) {
  const plan = await prisma.training_plans.findUnique({
    where: { id: planId },
    select: {
      name: true,
      lifecycleStatus: true,
      goalRaceTime: true,
      Athlete: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          gofastHandle: true,
          city: true,
          state: true,
          photoURL: true,
          fiveKPace: true,
          thresholdPace: true,
          aerobicCeilingBpm: true,
          longRunCapabilityMiles: true,
          longRunCapabilityPaceSecPerMile: true,
          longRunCapabilityDate: true,
        },
      },
      race_registry: { select: { name: true, raceDate: true } },
      athlete_race: { select: { name: true, goalTime: true, raceDay: true } },
    },
  });
  if (!plan?.Athlete) return null;

  const athlete = plan.Athlete;
  const longRunPace =
    athlete.longRunCapabilityPaceSecPerMile != null && athlete.longRunCapabilityPaceSecPerMile > 0
      ? formatPaceMinSec(athlete.longRunCapabilityPaceSecPerMile)
      : null;

  return {
    athlete: {
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      email: athlete.email,
      gofastHandle: athlete.gofastHandle,
      photoURL: athlete.photoURL,
      city: athlete.city,
      state: athlete.state,
      fiveKPace: paceOrNull(athlete.fiveKPace),
      thresholdPace: paceOrNull(athlete.thresholdPace),
      aerobicCeilingBpm: athlete.aerobicCeilingBpm,
      longRunCapabilityMiles: athlete.longRunCapabilityMiles,
      longRunCapabilityPace: longRunPace,
      longRunCapabilityDate: athlete.longRunCapabilityDate
        ? ymdFromDate(athlete.longRunCapabilityDate)
        : null,
    },
    plan: {
      name: plan.name,
      lifecycleStatus: plan.lifecycleStatus,
      raceName: plan.race_registry?.name ?? plan.athlete_race?.name ?? null,
      raceDate: plan.race_registry?.raceDate
        ? ymdFromDate(plan.race_registry.raceDate)
        : plan.athlete_race?.raceDay ?? null,
      goalTime: plan.athlete_race?.goalTime ?? plan.goalRaceTime,
    },
  };
}

const MIN_AEROBIC_BPM = 80;
const MAX_AEROBIC_BPM = 210;

function parseAerobicCeiling(
  raw: unknown,
): { ok: true; bpm: number | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, bpm: null };
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < MIN_AEROBIC_BPM || n > MAX_AEROBIC_BPM) {
    return { ok: false, error: "Aerobic ceiling must be 80–210 bpm" };
  }
  return { ok: true, bpm: n };
}

function parseLongRunMiles(
  raw: unknown,
): { ok: true; miles: number | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, miles: null };
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 50) {
    return { ok: false, error: "Long run must be between 0 and 50 miles" };
  }
  return { ok: true, miles: Math.round(n * 10) / 10 };
}

function parseLongRunDate(
  raw: unknown,
): { ok: true; date: Date | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, date: null };
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false, error: "Long run date must be YYYY-MM-DD" };
  }
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month! - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, error: "Long run date must be YYYY-MM-DD" };
  }
  return { ok: true, date };
}

export type CompanyPlanBaselineInput = {
  fiveKPace?: unknown;
  thresholdPace?: unknown;
  aerobicCeilingBpm?: unknown;
  longRunCapabilityMiles?: unknown;
  longRunCapabilityPace?: unknown;
  longRunCapabilityDate?: unknown;
};

export async function updateCompanyPlanBaselines(
  planId: string,
  body: CompanyPlanBaselineInput,
): Promise<{ ok: true; athlete: NonNullable<Awaited<ReturnType<typeof loadCompanyPlanAthlete>>>["athlete"] } | { ok: false; error: string }> {
  const fiveK = canonicalFiveKPace(body.fiveKPace);
  if (!fiveK.ok) return fiveK;
  const threshold = canonicalOptionalMilePace(body.thresholdPace, "threshold pace");
  if (!threshold.ok) return threshold;
  const ceiling = parseAerobicCeiling(body.aerobicCeilingBpm);
  if (!ceiling.ok) return ceiling;
  const miles = parseLongRunMiles(body.longRunCapabilityMiles);
  if (!miles.ok) return miles;
  const longRunPace = canonicalOptionalMilePace(body.longRunCapabilityPace, "long run pace");
  if (!longRunPace.ok) return longRunPace;
  const longRunDate = parseLongRunDate(body.longRunCapabilityDate);
  if (!longRunDate.ok) return longRunDate;

  const plan = await prisma.training_plans.findUnique({
    where: { id: planId },
    select: { athleteId: true, Athlete: { select: { fiveKPace: true } } },
  });
  if (!plan) return { ok: false, error: "Plan not found" };

  const clearLongRun = miles.miles == null;
  let longRunSeconds: number | null = null;
  if (!clearLongRun && longRunPace.pace) {
    longRunSeconds = Math.round(parsePaceToSecondsPerMile(longRunPace.pace));
  }

  await prisma.athlete.update({
    where: { id: plan.athleteId },
    data: {
      fiveKPace: fiveK.pace,
      thresholdPace: threshold.pace,
      aerobicCeilingBpm: ceiling.bpm,
      longRunCapabilityMiles: miles.miles,
      longRunCapabilityPaceSecPerMile: clearLongRun ? null : longRunSeconds,
      longRunCapabilityDate: clearLongRun ? null : longRunDate.date,
      updatedAt: new Date(),
    },
  });

  if ((plan.Athlete?.fiveKPace?.trim() || null) !== fiveK.pace) {
    await syncAthleteFiveKPaceToActivePlan(plan.athleteId);
  }

  const detail = await loadCompanyPlanAthlete(planId);
  if (!detail) return { ok: false, error: "Plan not found" };
  return { ok: true, athlete: detail.athlete };
}
