/**
 * Athlete-public training plans — promote, discover, and load by slug.
 * Source of truth: training_plans (name + planSchedule + publicSlug).
 */

import { PublicTrainingPlanVisibility, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import { loadCatalogueTitleByIdForWeekSchedule } from "@/lib/training/catalogue-title-map";
import { planScheduleDaysForWeek } from "@/lib/training/plan-schedule";
import { effectiveTrainingWeekCount } from "@/lib/training/plan-utils";
import { appendSlugSuffix, slugifyPlanSlug } from "@/lib/training/public-plan-slug";

export { slugifyPlanSlug } from "@/lib/training/public-plan-slug";

export type PublicPlanWeekDay = {
  dateKey: string;
  title: string;
  workoutType: string;
  estimatedDistanceInMeters: number;
  dayAssigned: string | null;
};

export type PublicPlanWeek = {
  weekNumber: number;
  days: PublicPlanWeekDay[];
  totalMiles: number;
};

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  gofastHandle: true,
  photoURL: true,
} as const;

export async function uniqueTrainingPlanPublicSlug(base: string): Promise<string> {
  const cleaned = slugifyPlanSlug(base) || "training-plan";
  for (let i = 0; i < 8; i++) {
    const suffix = i === 0 ? "" : `-${Math.random().toString(36).slice(2, 6)}`;
    const slug = appendSlugSuffix(cleaned, suffix);
    const exists = await prisma.training_plans.findFirst({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  return `${cleaned}-${Date.now().toString(36)}`.slice(0, 80);
}

export async function listDiscoverablePublicPlans(limit = 24) {
  return prisma.training_plans.findMany({
    where: { publicVisibility: PublicTrainingPlanVisibility.PUBLIC },
    orderBy: [{ publicPublishedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
}

export async function listPublicPlansForAthlete(athleteId: string) {
  return prisma.training_plans.findMany({
    where: {
      athleteId,
      publicVisibility: {
        in: [
          PublicTrainingPlanVisibility.PUBLIC,
          PublicTrainingPlanVisibility.UNLISTED,
        ],
      },
    },
    orderBy: { publicPublishedAt: "desc" },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicDescription: true,
      totalWeeks: true,
      publicPublishedAt: true,
      publicVisibility: true,
      race_registry: { select: { distanceLabel: true } },
    },
  });
}

export async function getPublicPlanBySlug(
  rawSlug: string,
  options?: { allowUnlisted?: boolean; authorAthleteId?: string }
) {
  const slug = slugifyPlanSlug(rawSlug);
  if (!slug) return null;

  const visibilityFilter: PublicTrainingPlanVisibility[] = [
    PublicTrainingPlanVisibility.PUBLIC,
  ];
  if (options?.allowUnlisted) {
    visibilityFilter.push(PublicTrainingPlanVisibility.UNLISTED);
  }
  if (options?.authorAthleteId) {
    visibilityFilter.push(PublicTrainingPlanVisibility.DRAFT);
  }

  const plan = await prisma.training_plans.findFirst({
    where: {
      publicSlug: slug,
      publicVisibility: { in: visibilityFilter },
      ...(options?.authorAthleteId ? { athleteId: options.authorAthleteId } : {}),
    },
    include: {
      Athlete: { select: authorSelect },
      race_registry: {
        select: {
          name: true,
          distanceLabel: true,
          raceDate: true,
          distanceMeters: true,
        },
      },
      training_plan_preset: {
        select: {
          id: true,
          title: true,
          publicDescription: true,
        },
      },
    },
  });

  return plan;
}

export type PromotePublicPlanInput = {
  trainingPlanId: string;
  athleteId: string;
  visibility?: PublicTrainingPlanVisibility;
  description?: string | null;
  regenerateSlug?: boolean;
};

export async function promoteTrainingPlanPublic(input: PromotePublicPlanInput) {
  const {
    trainingPlanId,
    athleteId,
    visibility = PublicTrainingPlanVisibility.PUBLIC,
    description,
    regenerateSlug = false,
  } = input;

  const plan = await prisma.training_plans.findFirst({
    where: { id: trainingPlanId, athleteId },
    include: {
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });

  if (!plan) throw new Error("Training plan not found");
  if (!plan.presetId) {
    throw new Error("Plan must be generated from a preset before publishing");
  }
  if (!plan.planSchedule) {
    throw new Error("Generate your schedule before publishing a public plan");
  }
  const planName = plan.name?.trim();
  if (!planName) throw new Error("Plan must have a name before publishing");

  const now = new Date();
  const publicPublishedAt =
    visibility === PublicTrainingPlanVisibility.PUBLIC ||
    visibility === PublicTrainingPlanVisibility.UNLISTED
      ? plan.publicPublishedAt ?? now
      : null;

  let publicSlug = plan.publicSlug;
  if (!publicSlug || regenerateSlug) {
    publicSlug = await uniqueTrainingPlanPublicSlug(planName);
  }

  return prisma.training_plans.update({
    where: { id: plan.id },
    data: {
      publicSlug,
      publicVisibility: visibility,
      publicPublishedAt,
      publicDescription:
        description !== undefined ? description?.trim() || null : plan.publicDescription,
      updatedAt: now,
    },
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
}

export async function computePublicPlanWeek(params: {
  planSchedule: unknown;
  planStartDate: Date;
  storedTotalWeeks: number;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
}): Promise<PublicPlanWeek> {
  const effectiveWeeks = effectiveTrainingWeekCount(
    params.planStartDate,
    params.storedTotalWeeks,
    params.raceDate
  );
  const catalogueTitleById = await loadCatalogueTitleByIdForWeekSchedule(
    params.planSchedule,
    params.weekNumber,
    effectiveWeeks
  );
  const days = planScheduleDaysForWeek({
    planStartDate: params.planStartDate,
    planSchedule: params.planSchedule,
    weekNumber: params.weekNumber,
    raceDate: params.raceDate,
    raceName: params.raceName,
    raceDistanceMiles: params.raceDistanceMiles,
    totalWeeks: effectiveWeeks,
    catalogueTitleById,
  });

  const mapped: PublicPlanWeekDay[] = days.map((d) => ({
    dateKey: d.dateKey,
    title: d.title,
    workoutType: d.workoutType,
    estimatedDistanceInMeters: d.estimatedDistanceInMeters,
    dayAssigned: d.dayAssigned ?? null,
  }));

  const totalMeters = mapped.reduce((s, d) => s + (d.estimatedDistanceInMeters ?? 0), 0);

  return {
    weekNumber: params.weekNumber,
    days: mapped,
    totalMiles: Math.round((totalMeters / 1609.34) * 10) / 10,
  };
}

export async function computeAllPublicPlanWeeks(plan: {
  planSchedule: unknown;
  startDate: Date;
  totalWeeks: number;
  race_registry: {
    name: string;
    raceDate: Date;
    distanceMeters: number | null;
  } | null;
}): Promise<PublicPlanWeek[]> {
  const raceDate = plan.race_registry?.raceDate ?? null;
  const raceName = plan.race_registry?.name ?? null;
  const raceDistanceMiles =
    plan.race_registry?.distanceMeters != null &&
    Number.isFinite(Number(plan.race_registry.distanceMeters))
      ? metersToMiles(Number(plan.race_registry.distanceMeters))
      : null;

  const effectiveWeeks = effectiveTrainingWeekCount(
    plan.startDate,
    plan.totalWeeks,
    raceDate
  );

  const weeks: PublicPlanWeek[] = [];
  for (let wn = 1; wn <= effectiveWeeks; wn++) {
    weeks.push(
      await computePublicPlanWeek({
        planSchedule: plan.planSchedule,
        planStartDate: plan.startDate,
        storedTotalWeeks: plan.totalWeeks,
        weekNumber: wn,
        raceDate,
        raceName,
        raceDistanceMiles,
      })
    );
  }
  return weeks;
}

export function mapPublishedPlanCard(plan: {
  id: string;
  name: string;
  publicSlug: string | null;
  publicDescription: string | null;
  totalWeeks: number;
  publicPublishedAt: Date | null;
  race_registry: { distanceLabel: string | null } | null;
}) {
  return {
    id: plan.id,
    slug: plan.publicSlug ?? "",
    title: plan.name,
    description: plan.publicDescription,
    targetDistanceLabel: plan.race_registry?.distanceLabel ?? null,
    durationWeeks: plan.totalWeeks,
    publishedAt: plan.publicPublishedAt?.toISOString() ?? null,
  };
}

export function mapPublicPlanApiResponse(plan: {
  id: string;
  name: string;
  publicSlug: string | null;
  publicDescription: string | null;
  publicVisibility: PublicTrainingPlanVisibility | null;
  publicPublishedAt: Date | null;
  totalWeeks: number;
  Athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
  };
  race_registry: { name: string; distanceLabel: string | null } | null;
}) {
  return {
    id: plan.id,
    slug: plan.publicSlug,
    title: plan.name,
    description: plan.publicDescription,
    visibility: plan.publicVisibility,
    publishedAt: plan.publicPublishedAt?.toISOString() ?? null,
    durationWeeks: plan.totalWeeks,
    targetDistanceLabel: plan.race_registry?.distanceLabel ?? null,
    author: plan.Athlete,
    raceName: plan.race_registry?.name ?? null,
  };
}

export async function listAuthorPublicPlans(athleteId: string) {
  const plans = await prisma.training_plans.findMany({
    where: {
      athleteId,
      publicVisibility: { not: null },
    },
    orderBy: [{ publicPublishedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
  return plans.map(mapPublicPlanApiResponse);
}

export type UpdatePublicPlanInput = {
  description?: string | null;
  visibility?: PublicTrainingPlanVisibility;
  name?: string;
  regenerateSlug?: boolean;
};

export async function updatePublicTrainingPlanBySlug(
  slug: string,
  athleteId: string,
  input: UpdatePublicPlanInput
) {
  const existing = await getPublicPlanBySlug(slug, {
    allowUnlisted: true,
    authorAthleteId: athleteId,
  });
  if (!existing || existing.athleteId !== athleteId) {
    throw new Error("Plan not found");
  }

  const data: Prisma.training_plansUpdateInput = { updatedAt: new Date() };

  if (input.description !== undefined) {
    data.publicDescription =
      typeof input.description === "string" ? input.description.trim() || null : null;
  }

  if (input.name !== undefined && input.name.trim()) {
    data.name = input.name.trim();
    if (input.regenerateSlug) {
      data.publicSlug = await uniqueTrainingPlanPublicSlug(input.name.trim());
    }
  }

  if (input.visibility) {
    data.publicVisibility = input.visibility;
    if (
      input.visibility === PublicTrainingPlanVisibility.PUBLIC ||
      input.visibility === PublicTrainingPlanVisibility.UNLISTED
    ) {
      data.publicPublishedAt = existing.publicPublishedAt ?? new Date();
    } else {
      data.publicPublishedAt = null;
    }
  }

  return prisma.training_plans.update({
    where: { id: existing.id },
    data,
    include: {
      Athlete: { select: authorSelect },
      race_registry: { select: { name: true, distanceLabel: true } },
    },
  });
}
