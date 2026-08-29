import type { Prisma, workout_catalogue } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCatalogueSlug } from "@/lib/training/catalogue-slug";
import { newEntityId } from "@/lib/training/new-entity-id";

export function athleteDisplayLabel(athlete: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  gofastHandle?: string | null;
}): string {
  const name = [athlete.firstName, athlete.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (athlete.gofastHandle?.trim()) return `@${athlete.gofastHandle.trim()}`;
  if (athlete.email?.trim()) return athlete.email.trim();
  return "athlete";
}

export async function uniqueStaffCatalogueSlug(baseName: string): Promise<string> {
  const base = generateCatalogueSlug(baseName);
  let slug = base;
  let n = 2;
  while (
    await prisma.workout_catalogue.findFirst({
      where: { slug, ownerAthleteId: null },
      select: { id: true },
    })
  ) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function catalogueRowData(
  source: workout_catalogue,
  opts: { slug: string; notes: string | null }
): Prisma.workout_catalogueCreateInput {
  return {
    id: newEntityId(),
    name: source.name,
    runSubType: source.runSubType,
    slug: opts.slug,
    description: source.description,
    workoutType: source.workoutType,
    segmentPaceDist:
      source.segmentPaceDist === null
        ? undefined
        : (source.segmentPaceDist as Prisma.InputJsonValue),
    warmupFraction: source.warmupFraction,
    workFraction: source.workFraction,
    cooldownFraction: source.cooldownFraction,
    workBaseReps: source.workBaseReps,
    workBaseRepMeters: source.workBaseRepMeters,
    recoveryDistanceMeters: source.recoveryDistanceMeters,
    recoveryDurationSeconds: source.recoveryDurationSeconds,
    warmupMiles: source.warmupMiles,
    warmupPaceOffsetSecPerMile: source.warmupPaceOffsetSecPerMile,
    cooldownMiles: source.cooldownMiles,
    cooldownPaceOffsetSecPerMile: source.cooldownPaceOffsetSecPerMile,
    workBaseMiles: source.workBaseMiles,
    workPaceOffsetSecPerMile: source.workPaceOffsetSecPerMile,
    workBasePaceOffsetSecPerMile: source.workBasePaceOffsetSecPerMile,
    recoveryPaceOffsetSecPerMile: source.recoveryPaceOffsetSecPerMile,
    paceAnchor: source.paceAnchor,
    mpFraction: source.mpFraction,
    mpBlockPosition: source.mpBlockPosition,
    mpBlockProgression: source.mpBlockProgression,
    mpTotalMiles: source.mpTotalMiles,
    mpPaceOffsetSecPerMile: source.mpPaceOffsetSecPerMile,
    intendedHeartRateZone: source.intendedHeartRateZone,
    intendedHRBpmLow: source.intendedHRBpmLow,
    intendedHRBpmHigh: source.intendedHRBpmHigh,
    notes: opts.notes,
    trainingIntent: source.trainingIntent,
    updatedAt: new Date(),
  };
}

export async function promoteAthleteCatalogueToStaff(sourceId: string): Promise<workout_catalogue> {
  const source = await prisma.workout_catalogue.findUnique({
    where: { id: sourceId },
    include: {
      ownerAthlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          gofastHandle: true,
        },
      },
    },
  });

  if (!source) {
    throw new Error("NOT_FOUND");
  }
  if (!source.ownerAthleteId) {
    throw new Error("ALREADY_STAFF");
  }

  const athleteLabel = source.ownerAthlete
    ? athleteDisplayLabel(source.ownerAthlete)
    : "athlete";

  const existingStaff = await prisma.workout_catalogue.findFirst({
    where: {
      ownerAthleteId: null,
      name: source.name,
      workoutType: source.workoutType,
    },
    select: { id: true },
  });
  if (existingStaff) {
    throw new Error("DUPLICATE_STAFF_NAME");
  }

  const slug = await uniqueStaffCatalogueSlug(source.name);
  const promoteNote = `Promoted from athlete catalogue ${source.id} (${athleteLabel})`;
  const notes = source.notes?.trim()
    ? `${source.notes.trim()}\n${promoteNote}`
    : promoteNote;

  return prisma.workout_catalogue.create({
    data: catalogueRowData(source, { slug, notes }),
  });
}
