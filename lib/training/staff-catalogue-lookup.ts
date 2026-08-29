import type { Prisma, WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Staff/Company catalogue row — ownerAthleteId is null. */
export function staffCatalogueWhere(name: string, workoutType: WorkoutType) {
  return {
    name,
    workoutType,
    ownerAthleteId: null,
  } satisfies Prisma.workout_catalogueWhereInput;
}

export async function findStaffCatalogueByNameAndType(
  name: string,
  workoutType: WorkoutType,
  client: Pick<typeof prisma, "workout_catalogue"> = prisma
) {
  return client.workout_catalogue.findFirst({
    where: staffCatalogueWhere(name, workoutType),
  });
}
