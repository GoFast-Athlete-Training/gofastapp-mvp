import type { RaceWeekSlotForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";
import type { PhaseWeekRow } from "@/lib/training/phase-week-pins";
import { TAPER_CALENDAR_WEEKS, taperWeeklyMileageTarget } from "@/lib/training/preset-volume-helpers";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Build-week targets climb from athlete start to preset peak; taper/race use phase caps when set. */
export function buildWeeklyMileageTargetsByWeek(params: {
  totalWeeks: number;
  taperStartWeekNumber: number;
  peakWeekNumber: number;
  athleteStartMiles: number;
  presetMinMiles: number;
  presetPeakMiles: number;
  taperWeeks: PhaseWeekRow[] | null | undefined;
  raceWeek: RaceWeekSlotForGenerate[] | PhaseWeekRow[] | null | undefined;
}): Map<number, number> {
  const out = new Map<number, number>();
  const taperStart = Math.max(1, Math.floor(params.taperStartWeekNumber));
  const peakWeek = Math.max(1, Math.floor(params.peakWeekNumber));
  const start = round2(
    clamp(params.athleteStartMiles, params.presetMinMiles, params.presetPeakMiles),
  );
  const peak = Math.max(start, params.presetPeakMiles);

  for (let w = 1; w < taperStart; w++) {
    const denom = Math.max(1, peakWeek - 1);
    const t = w >= peakWeek ? 1 : (w - 1) / denom;
    out.set(w, round2(start + (peak - start) * t));
  }

  const taperRows = params.taperWeeks ?? [];
  for (let i = 0; i < TAPER_CALENDAR_WEEKS; i++) {
    const weekNum = params.totalWeeks - TAPER_CALENDAR_WEEKS + 1 + i;
    if (weekNum >= taperStart && weekNum < params.totalWeeks) {
      const row = taperRows.find((r) => r.weekIndex === i + 1);
      const cap = row?.totalMilesCap;
      out.set(
        weekNum,
        cap != null && cap > 0 ? round2(cap) : taperWeeklyMileageTarget(peak),
      );
    }
  }

  const slots = params.raceWeek;
  let raceCap: number | null = null;
  if (Array.isArray(slots) && slots.length > 0) {
    const first = slots[0] as RaceWeekSlotForGenerate | PhaseWeekRow;
    if ("offsetFromRace" in first) {
      raceCap = (slots as RaceWeekSlotForGenerate[])
        .filter(
          (s) =>
            s.type !== "off" &&
            s.type !== "race" &&
            s.prescribedMiles != null &&
            s.prescribedMiles > 0,
        )
        .reduce((sum, s) => sum + (s.prescribedMiles ?? 0), 0);
    } else {
      const raceRow = (slots as PhaseWeekRow[]).find((r) => r.weekIndex === 1);
      raceCap = raceRow?.totalMilesCap ?? null;
    }
  }
  out.set(
    params.totalWeeks,
    raceCap != null && raceCap > 0 ? round2(raceCap) : taperWeeklyMileageTarget(peak),
  );

  return out;
}
