import type { RaceWeekSlot, RaceWeekSlotType } from "@/lib/training/race-week-slots";

/** Taper W1: seven days ending eight days before race. W2: seven days ending one day before race. */
export const TAPER_W1_OFFSETS = [-14, -13, -12, -11, -10, -9, -8] as const;
export const TAPER_W2_OFFSETS = [-7, -6, -5, -4, -3, -2, -1] as const;
export const TAPER_WEEK_OFFSETS = [...TAPER_W1_OFFSETS, ...TAPER_W2_OFFSETS] as const;

export type TaperWeekSlotType = Exclude<RaceWeekSlotType, "race" | "off">;

export type TaperWeekSlot = Omit<RaceWeekSlot, "type"> & { type: TaperWeekSlotType };

const SLOT_TYPES: TaperWeekSlotType[] = ["easy", "tempo", "intervals", "shakeout-easy"];

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function defaultSlot(offsetFromRace: number): TaperWeekSlot {
  return {
    offsetFromRace,
    runName: "Easy",
    type: "easy",
    catalogueWorkoutId: null,
    prescribedMiles: null,
    shakeoutRunConfigId: null,
  };
}

export function parseTaperWeekSlots(raw: unknown): TaperWeekSlot[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const byOffset = new Map<number, TaperWeekSlot>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const offset = numOrNull(o.offsetFromRace);
    if (offset == null || !TAPER_WEEK_OFFSETS.includes(offset as (typeof TAPER_WEEK_OFFSETS)[number])) {
      continue;
    }
    const typeRaw = o.type;
    const type =
      typeof typeRaw === "string" && SLOT_TYPES.includes(typeRaw as TaperWeekSlotType)
        ? (typeRaw as TaperWeekSlotType)
        : "easy";
    byOffset.set(offset, {
      offsetFromRace: offset,
      runName: typeof o.runName === "string" ? o.runName : defaultSlot(offset).runName,
      type,
      catalogueWorkoutId: strOrNull(o.catalogueWorkoutId),
      prescribedMiles: numOrNull(o.prescribedMiles),
      shakeoutRunConfigId: strOrNull(o.shakeoutRunConfigId),
    });
  }
  return TAPER_WEEK_OFFSETS.filter((off) => byOffset.has(off)).map(
    (off) => byOffset.get(off)!,
  );
}

export function defaultTaperWeekSlots(): TaperWeekSlot[] {
  return TAPER_WEEK_OFFSETS.map((offsetFromRace) => defaultSlot(offsetFromRace));
}

export function taperOffsetLabel(offsetFromRace: number): string {
  if (offsetFromRace === -1) return "Day before race";
  if (offsetFromRace === 0) return "Race day";
  return `${Math.abs(offsetFromRace)}d before race`;
}
