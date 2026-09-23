/**
 * Long-run builder — walk rotation slot miles up to a single peak long run.
 * Replaces pool × distributionWeight for new preset core flows (stub / next generate).
 */

import { TAPER_CALENDAR_WEEKS } from "@/lib/training/preset-volume-helpers";

export type LongRunRotationSlot = {
  cyclePosition: number;
  slotMiles: number;
  catalogueWorkoutId?: string | null;
  isCutback?: boolean;
};

export type LongRunWeekAssignment = {
  weekNumber: number;
  miles: number;
  role: "build" | "peak" | "cutback" | "taper";
  catalogueWorkoutId?: string | null;
};

export type BuildLongRunScheduleInput = {
  totalWeeks: number;
  peakLongRunMiles: number;
  taperCalendarWeeks?: number;
  slots: readonly LongRunRotationSlot[];
};

function round1(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10);
}

function sortedSlots(slots: readonly LongRunRotationSlot[]): LongRunRotationSlot[] {
  return [...slots].sort((a, b) => a.cyclePosition - b.cyclePosition);
}

function buildSlots(slots: readonly LongRunRotationSlot[]): LongRunRotationSlot[] {
  return sortedSlots(slots).filter((s) => !s.isCutback && s.slotMiles > 0);
}

function cutbackSlot(slots: readonly LongRunRotationSlot[]): LongRunRotationSlot | null {
  return sortedSlots(slots).find((s) => s.isCutback) ?? null;
}

export function buildLongRunSchedule(input: BuildLongRunScheduleInput): LongRunWeekAssignment[] {
  const totalWeeks = Math.max(1, Math.floor(input.totalWeeks));
  const taperWeeks = Math.max(1, Math.floor(input.taperCalendarWeeks ?? TAPER_CALENDAR_WEEKS));
  const peakMi = round1(input.peakLongRunMiles);
  const build = buildSlots(input.slots);
  const cutback = cutbackSlot(input.slots);

  const taperStart = Math.max(1, totalWeeks - taperWeeks + 1);
  const buildWeekCount = taperStart - 1;
  if (buildWeekCount <= 0) {
    return Array.from({ length: totalWeeks }, (_, i) => ({
      weekNumber: i + 1,
      miles: round1(peakMi * 0.5),
      role: "taper" as const,
    }));
  }

  const needsCutback = cutback != null && buildWeekCount >= build.length + 2;
  const peakWeek = needsCutback ? buildWeekCount - 1 : buildWeekCount;
  const prePeakBuildWeeks = Math.max(0, peakWeek - 1);

  const out: LongRunWeekAssignment[] = [];

  for (let wn = 1; wn <= totalWeeks; wn++) {
    if (wn >= taperStart) {
      const taperIdx = wn - taperStart;
      const scale = 1 - taperIdx / taperWeeks;
      out.push({
        weekNumber: wn,
        miles: round1(Math.max(8, peakMi * 0.35 * scale + 8 * (1 - scale))),
        role: "taper",
      });
      continue;
    }

    if (wn === peakWeek) {
      out.push({ weekNumber: wn, miles: peakMi, role: "peak" });
      continue;
    }

    if (needsCutback && wn === buildWeekCount) {
      out.push({
        weekNumber: wn,
        miles: round1(cutback!.slotMiles),
        role: "cutback",
        catalogueWorkoutId: cutback!.catalogueWorkoutId,
      });
      continue;
    }

    if (wn < peakWeek) {
      const idx = (wn - 1) % Math.max(1, build.length);
      const slot = build[idx] ?? build[0];
      out.push({
        weekNumber: wn,
        miles: round1(slot?.slotMiles ?? peakMi * 0.6),
        role: "build",
        catalogueWorkoutId: slot?.catalogueWorkoutId,
      });
      continue;
    }

    out.push({
      weekNumber: wn,
      miles: round1(build[build.length - 1]?.slotMiles ?? peakMi * 0.75),
      role: "build",
    });
  }

  return out;
}

/** Derive slot miles from catalogue workBaseMiles or weight × peak fallback. */
export function rotationSlotMilesFromCatalogue(input: {
  distributionWeight: number;
  workBaseMiles: number | null | undefined;
  peakLongRunMiles: number;
  slotIndex: number;
  slotCount: number;
}): number {
  const wb = Number(input.workBaseMiles);
  if (Number.isFinite(wb) && wb > 0) return round1(wb);
  const w = Math.max(0, Number(input.distributionWeight) || 0);
  const share = w > 0 ? w : 1 / Math.max(1, input.slotCount);
  return round1(input.peakLongRunMiles * share * 0.85);
}

const CUTBACK_RE = /cut\s*back|cutback|recovery|easy|short|shake/i;

export function markCutbackSlots(
  slots: Array<LongRunRotationSlot & { name?: string | null }>,
): LongRunRotationSlot[] {
  if (slots.length < 4) return slots.map((s) => ({ ...s, isCutback: false }));
  const cutIdx = slots.findIndex(
    (s, i) => i === slots.length - 1 && CUTBACK_RE.test(s.name ?? ""),
  );
  return slots.map((s, i) => ({
    ...s,
    isCutback: cutIdx >= 0 ? i === cutIdx : i === slots.length - 1,
  }));
}
