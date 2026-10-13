export type RaceWeekSlotType =
  | "easy"
  | "tempo"
  | "intervals"
  | "shakeout-easy"
  | "off"
  | "race";

export type RaceWeekSlot = {
  offsetFromRace: number;
  runName: string;
  type: RaceWeekSlotType;
  catalogueWorkoutId: string | null;
  prescribedMiles: number | null;
  shakeoutRunConfigId: string | null;
};

export const RACE_WEEK_OFFSETS = [-6, -5, -4, -3, -2, -1, 0] as const;

const SLOT_TYPES: RaceWeekSlotType[] = [
  "easy",
  "tempo",
  "intervals",
  "shakeout-easy",
  "off",
  "race",
];

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function defaultSlot(offsetFromRace: number): RaceWeekSlot {
  if (offsetFromRace === -2) {
    return {
      offsetFromRace,
      runName: "Shakeout",
      type: "shakeout-easy",
      catalogueWorkoutId: null,
      prescribedMiles: null,
      shakeoutRunConfigId: null,
    };
  }
  if (offsetFromRace === -1) {
    return {
      offsetFromRace,
      runName: "Off",
      type: "off",
      catalogueWorkoutId: null,
      prescribedMiles: null,
      shakeoutRunConfigId: null,
    };
  }
  if (offsetFromRace === 0) {
    return {
      offsetFromRace,
      runName: "Race",
      type: "race",
      catalogueWorkoutId: null,
      prescribedMiles: null,
      shakeoutRunConfigId: null,
    };
  }
  return {
    offsetFromRace,
    runName: offsetFromRace === -5 ? "Light tempo" : "Easy",
    type: offsetFromRace === -5 ? "tempo" : "easy",
    catalogueWorkoutId: null,
    prescribedMiles: null,
    shakeoutRunConfigId: null,
  };
}

export function defaultRaceWeekSlots(): RaceWeekSlot[] {
  return RACE_WEEK_OFFSETS.map((offsetFromRace) => defaultSlot(offsetFromRace));
}

export function parseRaceWeekSlots(raw: unknown): RaceWeekSlot[] {
  const defaults = defaultRaceWeekSlots();
  if (!Array.isArray(raw) || raw.length === 0) return defaults;

  return defaults.map((def) => {
    const found = raw.find((item) => {
      if (item == null || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return Number(row.offsetFromRace) === def.offsetFromRace;
    }) as Record<string, unknown> | undefined;

    if (!found) return def;

    const typeRaw = found.type ?? found.slotType;
    const type = SLOT_TYPES.includes(typeRaw as RaceWeekSlotType)
      ? (typeRaw as RaceWeekSlotType)
      : def.type;

    return {
      offsetFromRace: def.offsetFromRace,
      runName:
        typeof found.runName === "string" && found.runName.trim()
          ? found.runName.trim()
          : def.runName,
      type,
      catalogueWorkoutId: strOrNull(found.catalogueWorkoutId),
      prescribedMiles: numOrNull(found.prescribedMiles),
      shakeoutRunConfigId: strOrNull(found.shakeoutRunConfigId),
    };
  });
}
