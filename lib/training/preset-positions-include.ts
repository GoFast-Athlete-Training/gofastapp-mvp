/**
 * Prisma include fragments for preset rotation positions — no imports from
 * plan-generate-presets-loader or apply-athlete-rotation-order (avoids circular deps).
 */

export const catalogueSelectForGeneration = {
  id: true,
  name: true,
  description: true,
  workoutType: true,
  slug: true,
  paceAnchor: true,
  segmentPaceDist: true,
  warmupMiles: true,
  cooldownMiles: true,
  workBaseMiles: true,
  workBaseReps: true,
  workBaseRepMeters: true,
} as const;

export const positionsInclude = {
  orderBy: { cyclePosition: "asc" as const },
  include: {
    workout_catalogue: {
      select: catalogueSelectForGeneration,
    },
  },
} as const;

export const athletePresetRotationInclude = {
  longRunConfig: { include: { positions: positionsInclude } },
  easyConfig: { include: { positions: positionsInclude } },
  longRunOrders: { orderBy: { cyclePosition: "asc" as const } },
  easyOrders: { orderBy: { cyclePosition: "asc" as const } },
  athleteTempoConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: catalogueSelectForGeneration,
          },
        },
      },
    },
  },
  athleteIntervalsConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: catalogueSelectForGeneration,
          },
        },
      },
    },
  },
} as const;
