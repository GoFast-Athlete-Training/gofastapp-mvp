import { prisma } from "@/lib/prisma";
import { formatPaceMinSec } from "@/lib/training/goal-pace-calculator";
import { syncAthleteFiveKPaceToActivePlan } from "@/lib/training/plan-lifecycle";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";

const MIN_FIVE_K_SEC = 3 * 60;
const MAX_FIVE_K_SEC = 20 * 60;

export function canonicalFiveKPace(
  raw: unknown,
): { ok: true; pace: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, error: "Enter a 5K pace like 7:30" };
  }
  let seconds: number;
  try {
    seconds = parsePaceToSecondsPerMile(raw);
  } catch {
    return { ok: false, error: "Enter a 5K pace like 7:30" };
  }
  if (seconds < MIN_FIVE_K_SEC || seconds > MAX_FIVE_K_SEC) {
    return { ok: false, error: "5K pace must be between 3:00 and 20:00 per mile" };
  }
  return { ok: true, pace: formatPaceMinSec(seconds) };
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

export async function updateCompanyPlanFiveKPace(
  planId: string,
  fiveKPace: unknown,
): Promise<{ ok: true; fiveKPace: string } | { ok: false; error: string }> {
  const parsed = canonicalFiveKPace(fiveKPace);
  if (!parsed.ok) return parsed;

  const plan = await prisma.training_plans.findUnique({
    where: { id: planId },
    select: { athleteId: true },
  });
  if (!plan) return { ok: false, error: "Plan not found" };

  await prisma.athlete.update({
    where: { id: plan.athleteId },
    data: { fiveKPace: parsed.pace, updatedAt: new Date() },
  });
  await syncAthleteFiveKPaceToActivePlan(plan.athleteId);
  return { ok: true, fiveKPace: parsed.pace };
}
