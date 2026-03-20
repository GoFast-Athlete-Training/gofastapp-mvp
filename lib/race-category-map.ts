/**
 * Map GoFastCompany Prisma RaceCategory enum values (strings) to prod race_registry fields.
 */

export type CategoryMapping = {
  raceType: string;
  distanceMiles: number;
  isVirtual: boolean;
};

const MILES = {
  fiveK: 3.10686,
  tenK: 6.21371,
  fifteenK: 9.32,
  tenMile: 10.0,
  half: 13.109375,
  marathon: 26.21875,
  ultra: 50.0,
} as const;

/** Company RaceCategory enum name → prod raceType + miles + virtual flag */
export function mapRaceCategoryToRegistry(
  category: string | null | undefined
): CategoryMapping {
  if (!category) {
    return { raceType: "5k", distanceMiles: MILES.fiveK, isVirtual: false };
  }

  const c = category.trim();

  const table: Record<string, CategoryMapping> = {
    FIVE_K: { raceType: "5k", distanceMiles: MILES.fiveK, isVirtual: false },
    TEN_K: { raceType: "10k", distanceMiles: MILES.tenK, isVirtual: false },
    FIFTEEN_K: { raceType: "15k", distanceMiles: MILES.fifteenK, isVirtual: false },
    TEN_MILE: { raceType: "10m", distanceMiles: MILES.tenMile, isVirtual: false },
    HALF_MARATHON: { raceType: "half", distanceMiles: MILES.half, isVirtual: false },
    MARATHON: { raceType: "marathon", distanceMiles: MILES.marathon, isVirtual: false },
    ULTRA: { raceType: "ultra", distanceMiles: MILES.ultra, isVirtual: false },
    VIRTUAL_FIVE_K: { raceType: "5k", distanceMiles: MILES.fiveK, isVirtual: true },
    VIRTUAL_TEN_K: { raceType: "10k", distanceMiles: MILES.tenK, isVirtual: true },
    VIRTUAL_HALF_MARATHON: { raceType: "half", distanceMiles: MILES.half, isVirtual: true },
    VIRTUAL_MARATHON: { raceType: "marathon", distanceMiles: MILES.marathon, isVirtual: true },
    RELAY: { raceType: "5k", distanceMiles: MILES.fiveK, isVirtual: false },
    FUN_RUN: { raceType: "5k", distanceMiles: MILES.fiveK, isVirtual: false },
    OTHER: { raceType: "5k", distanceMiles: MILES.fiveK, isVirtual: false },
  };

  return table[c] ?? { raceType: "5k", distanceMiles: MILES.fiveK, isVirtual: false };
}
