/**
 * Build workout_segments payload from a catalogue row + schedule miles + anchors.
 * Segment fields mirror workout_catalogue (warmup / work / cooldown).
 */

import type { workout_catalogue, WorkoutType } from "@prisma/client";
import type { ApiSegment } from "@/lib/workout-generator/templates";
import {
  getTrainingPaces,
  paceTargetFromSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { isMpSimulationAnchor } from "@/lib/training/goal-pace-calculator";
import {
  betweenRepRecoveryForMaterialization,
  type CatalogueBetweenRepRecovery,
} from "@/lib/training/catalogue-interval-recovery";

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** Anchor + sec/mi offset → absolute sec/mi, or null if no offset (= no pace target → Garmin OPEN). */
function secPerMile(
  anchor: number,
  offset: number | null | undefined
): number | null {
  if (offset == null) return null;
  return Math.max(1, anchor + offset);
}

function targetsOrOpen(paceSecPerMile: number | null): Pick<ApiSegment, "targets"> | object {
  if (paceSecPerMile == null) return {};
  return { targets: [paceTargetFromSecondsPerMile(paceSecPerMile)] };
}

function appendBetweenRepRecoveryStep(
  out: ApiSegment[],
  stepOrder: number,
  rec: CatalogueBetweenRepRecovery,
  recPace: number | null
): number {
  if (rec.kind === "none") return stepOrder;
  if (rec.kind === "time") {
    out.push({
      stepOrder,
      title: "Recovery",
      durationType: "TIME",
      durationValue: rec.durationValueMinutes,
      ...targetsOrOpen(recPace),
    });
    return stepOrder + 1;
  }
  out.push({
    stepOrder,
    title: "Recovery",
    durationType: "DISTANCE",
    durationValue: rec.durationValueMiles,
    ...targetsOrOpen(recPace),
  });
  return stepOrder + 1;
}

/** Scale peak mpFraction by plan cycle position (0–3 → 25%–100% of peak). */
export function effectiveMpFraction(
  peakFraction: number | null | undefined,
  planCycleIndex: number | null | undefined
): number {
  const peak =
    peakFraction != null && Number.isFinite(peakFraction) && peakFraction > 0
      ? Math.min(0.85, peakFraction)
      : 0.15;
  if (planCycleIndex == null || !Number.isFinite(planCycleIndex)) {
    return peak;
  }
  const idx = Math.max(0, Math.min(3, Math.floor(planCycleIndex)));
  const scale = 0.25 + (idx / 3) * 0.75;
  return Math.min(0.85, peak * scale);
}

/** Goal-MP prescription always resolves to a numeric pace (never conversational / OPEN). */
function mpPaceSecPerMile(params: {
  entry: workout_catalogue;
  fitnessAnchorSec: number;
  racePaceSecPerMile: number | null;
}): number {
  const { entry, fitnessAnchorSec, racePaceSecPerMile } = params;
  const paces = getTrainingPaces(fitnessAnchorSec);
  if (isMpSimulationAnchor(entry.paceAnchor) && racePaceSecPerMile != null) {
    const off = entry.workPaceOffsetSecPerMile;
    return off != null ? Math.max(1, racePaceSecPerMile + off) : racePaceSecPerMile;
  }
  const off = entry.mpPaceOffsetSecPerMile;
  return off != null ? Math.max(1, fitnessAnchorSec + off) : paces.marathon;
}

function isMilesWorkSegmentList(v: unknown): v is { miles: number; paceOffsetSecPerMile: number; reps?: number }[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (const row of v) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return false;
    const o = row as { miles?: unknown; paceOffsetSecPerMile?: unknown };
    const m = o.miles;
    if (m == null || !Number.isFinite(Number(m)) || Number(m) <= 0) return false;
  }
  return true;
}

function isIntervalWorkSegmentList(
  v: unknown
): v is { distanceMeters: number; paceOffsetSecPerMile: number; reps?: number }[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (const row of v) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return false;
    const o = row as { distanceMeters?: unknown; paceOffsetSecPerMile?: unknown };
    const d = o.distanceMeters;
    if (d == null || !Number.isFinite(Number(d)) || Number(d) <= 0) return false;
  }
  return true;
}

/**
 * Intervals — repeat a fixed sequence as one block (Over/Under): no recovery between segments inside the block;
 * optional timed jog between whole cycles. Stored as an object (not a plain array) in segmentPaceDist.
 *
 * ```json
 * {
 *   "layout": "blockRepeat",
 *   "segments": [{ "distanceMeters": 1609, "paceOffsetSecPerMile": 45 }],
 *   "repeatCount": 2,
 *   "recoveryBetweenCyclesSeconds": 90
 * }
 * ```
 *
 * TIME recovery segments use durationValue in **minutes** (same as Garmin assembler); e.g. 90s → 1.5.
 */
type IntervalBlockRepeatPayload = {
  layout: "blockRepeat";
  segments: Array<{ distanceMeters: number; paceOffsetSecPerMile: number | null }>;
  repeatCount: number;
  recoveryBetweenCyclesSeconds?: number;
};

function parseIntervalBlockRepeatPayload(v: unknown): IntervalBlockRepeatPayload | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.layout !== "blockRepeat") return null;
  const segments = o.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const parsedSegs: IntervalBlockRepeatPayload["segments"] = [];
  for (const row of segments) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return null;
    const r = row as { distanceMeters?: unknown; paceOffsetSecPerMile?: unknown };
    const dm = Number(r.distanceMeters);
    if (!Number.isFinite(dm) || dm <= 0) return null;
    let paceOffsetSecPerMile: number | null = null;
    if (Object.prototype.hasOwnProperty.call(r, "paceOffsetSecPerMile")) {
      const raw = r.paceOffsetSecPerMile;
      if (raw != null && raw !== "") {
        const off = Number(raw);
        if (!Number.isFinite(off)) return null;
        paceOffsetSecPerMile = Math.round(off);
      }
    }
    parsedSegs.push({
      distanceMeters: Math.round(dm),
      paceOffsetSecPerMile,
    });
  }
  const rc = Number(o.repeatCount);
  const repeatCount =
    Number.isFinite(rc) && rc >= 1 ? Math.min(99, Math.round(rc)) : 1;
  let recoveryBetweenCyclesSeconds: number | undefined;
  if (Object.prototype.hasOwnProperty.call(o, "recoveryBetweenCyclesSeconds")) {
    const rs = Number(o.recoveryBetweenCyclesSeconds);
    if (Number.isFinite(rs) && rs > 0) recoveryBetweenCyclesSeconds = Math.round(rs);
  }
  return {
    layout: "blockRepeat",
    segments: parsedSegs,
    repeatCount,
    recoveryBetweenCyclesSeconds,
  };
}

/**
 * Tempo — repeat a mile-based sequence with optional timed jog between whole cycles.
 * Same envelope as intervals blockRepeat; segments use `miles` instead of `distanceMeters`.
 */
type TempoBlockRepeatPayload = {
  layout: "blockRepeat";
  segments: Array<{ miles: number; paceOffsetSecPerMile: number | null }>;
  repeatCount: number;
  recoveryBetweenCyclesSeconds?: number;
};

function parseTempoBlockRepeatPayload(v: unknown): TempoBlockRepeatPayload | null {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.layout !== "blockRepeat") return null;
  const segments = o.segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const parsedSegs: TempoBlockRepeatPayload["segments"] = [];
  for (const row of segments) {
    if (row == null || typeof row !== "object" || Array.isArray(row)) return null;
    const r = row as { miles?: unknown; paceOffsetSecPerMile?: unknown };
    const mi = Number(r.miles);
    if (!Number.isFinite(mi) || mi <= 0) return null;
    let paceOffsetSecPerMile: number | null = null;
    if (Object.prototype.hasOwnProperty.call(r, "paceOffsetSecPerMile")) {
      const raw = r.paceOffsetSecPerMile;
      if (raw != null && raw !== "") {
        const off = Number(raw);
        if (!Number.isFinite(off)) return null;
        paceOffsetSecPerMile = Math.round(off);
      }
    }
    parsedSegs.push({
      miles: round(mi, 4),
      paceOffsetSecPerMile,
    });
  }
  const rc = Number(o.repeatCount);
  const repeatCount =
    Number.isFinite(rc) && rc >= 1 ? Math.min(99, Math.round(rc)) : 1;
  let recoveryBetweenCyclesSeconds: number | undefined;
  if (Object.prototype.hasOwnProperty.call(o, "recoveryBetweenCyclesSeconds")) {
    const rs = Number(o.recoveryBetweenCyclesSeconds);
    if (Number.isFinite(rs) && rs > 0) recoveryBetweenCyclesSeconds = Math.round(rs);
  }
  return {
    layout: "blockRepeat",
    segments: parsedSegs,
    repeatCount,
    recoveryBetweenCyclesSeconds,
  };
}

function buildSustainedQualityBlock(params: {
  entry: workout_catalogue;
  totalMiles: number;
  anchorSecondsPerMile: number;
  title: string;
}): ApiSegment[] {
  const { entry, totalMiles, anchorSecondsPerMile, title } = params;
  const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
  const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
  const prescribedMain = entry.workBaseMiles;
  const mainM = round(
    prescribedMain != null && prescribedMain > 0
      ? Math.min(prescribedMain, Math.max(0.25, totalMiles - warmupM - cooldownM))
      : Math.max(0.25, totalMiles - warmupM - cooldownM),
    2
  );
  const warmupPace = secPerMile(anchorSecondsPerMile, entry.warmupPaceOffsetSecPerMile);
  const cooldownPace = secPerMile(anchorSecondsPerMile, entry.cooldownPaceOffsetSecPerMile);
  const workPace = secPerMile(anchorSecondsPerMile, entry.workPaceOffsetSecPerMile);
  let order = 1;
  const out: ApiSegment[] = [];
  if (warmupM > 0) {
    out.push({
      stepOrder: order++,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: warmupM,
      ...targetsOrOpen(warmupPace),
    });
  }
  out.push({
    stepOrder: order++,
    title,
    durationType: "DISTANCE",
    durationValue: mainM,
    ...targetsOrOpen(workPace),
  });
  if (cooldownM > 0) {
    out.push({
      stepOrder: order++,
      title: "Cooldown",
      durationType: "DISTANCE",
      durationValue: cooldownM,
      ...targetsOrOpen(cooldownPace),
    });
  }
  return out;
}

export function catalogueEntryToApiSegments(params: {
  entry: workout_catalogue;
  scheduleMiles: number;
  anchorSecondsPerMile: number;
  racePaceSecondsPerMile?: number | null;
  planCycleIndex?: number | null;
}): ApiSegment[] {
  const {
    entry,
    scheduleMiles,
    anchorSecondsPerMile,
    racePaceSecondsPerMile = null,
    planCycleIndex = null,
  } = params;
  const totalMiles = scheduleMiles;

  const type = entry.workoutType as WorkoutType;

  if (type === "Easy") {
    const pace = secPerMile(anchorSecondsPerMile, entry.workPaceOffsetSecPerMile);
    return [
      {
        stepOrder: 1,
        title: "Easy Run",
        durationType: "DISTANCE",
        durationValue: round(totalMiles, 2),
        ...targetsOrOpen(pace),
      },
    ];
  }

  if (type === "LongRun") {
    const easyP = secPerMile(anchorSecondsPerMile, entry.recoveryPaceOffsetSecPerMile);
    const longP = secPerMile(anchorSecondsPerMile, entry.workPaceOffsetSecPerMile);
    const mpP = mpPaceSecPerMile({
      entry,
      fitnessAnchorSec: anchorSecondsPerMile,
      racePaceSecPerMile: racePaceSecondsPerMile,
    });

    const wj = entry.segmentPaceDist;
    if (isMilesWorkSegmentList(wj)) {
      const warmupM = entry.warmupMiles != null && entry.warmupMiles > 0 ? round(entry.warmupMiles, 2) : 0;
      const cooldownM =
        entry.cooldownMiles != null && entry.cooldownMiles > 0 ? round(entry.cooldownMiles, 2) : 0;
      let order = 1;
      const out: ApiSegment[] = [];
      if (warmupM > 0) {
        const wp = secPerMile(anchorSecondsPerMile, entry.warmupPaceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Warmup",
          durationType: "DISTANCE",
          durationValue: warmupM,
          ...targetsOrOpen(wp),
        });
      }
      let sumSeg = 0;
      for (const seg of wj) {
        const m = round(Math.max(0, Number(seg.miles)), 2);
        if (m <= 0) continue;
        sumSeg += m;
        const row = seg as { miles?: number; paceOffsetSecPerMile?: number | null };
        const p = secPerMile(anchorSecondsPerMile, row.paceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Long Run",
          durationType: "DISTANCE",
          durationValue: m,
          ...targetsOrOpen(p),
        });
      }
      const remain = round(
        Math.max(0, totalMiles - warmupM - cooldownM - sumSeg),
        2
      );
      if (remain > 0.05) {
        out.push({
          stepOrder: order++,
          title: "Long Run",
          durationType: "DISTANCE",
          durationValue: remain,
          ...targetsOrOpen(longP),
        });
      }
      if (cooldownM > 0) {
        const cp = secPerMile(anchorSecondsPerMile, entry.cooldownPaceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Cooldown",
          durationType: "DISTANCE",
          durationValue: cooldownM,
          ...targetsOrOpen(cp),
        });
      }
      if (out.length > 0) return out;
    }

    const wf0 = entry.warmupFraction;
    const wkf0 = entry.workFraction;
    const cf0 = entry.cooldownFraction;
    if (
      isMpSimulationAnchor(entry.paceAnchor) &&
      (wf0 != null ||
        wkf0 != null ||
        cf0 != null) &&
      ((wf0 != null && wf0 > 0) || (wkf0 != null && wkf0 > 0) || (cf0 != null && cf0 > 0))
    ) {
      const wf = Math.max(0, wf0 ?? 0);
      const wfk = Math.max(0, wkf0 ?? 0);
      const cf = Math.max(0, cf0 ?? 0);
      const wM = round(totalMiles * wf, 2);
      const workM = round(totalMiles * wfk, 2);
      const cM = round(totalMiles * cf, 2);
      let rem = round(totalMiles - wM - workM - cM, 2);
      if (rem < 0) rem = 0;
      let order = 1;
      const out: ApiSegment[] = [];
      if (wM > 0.05) {
        out.push({
          stepOrder: order++,
          title: "Warmup",
          durationType: "DISTANCE",
          durationValue: wM,
          ...targetsOrOpen(easyP),
        });
      }
      if (workM > 0.05) {
        out.push({
          stepOrder: order++,
          title: "Goal marathon pace",
          durationType: "DISTANCE",
          durationValue: workM,
          targets: [paceTargetFromSecondsPerMile(mpP)],
        });
      }
      if (rem > 0.05) {
        out.push({
          stepOrder: order++,
          title: "Long Run",
          durationType: "DISTANCE",
          durationValue: rem,
          ...targetsOrOpen(longP),
        });
      }
      if (cM > 0.05) {
        out.push({
          stepOrder: order++,
          title: "Cooldown",
          durationType: "DISTANCE",
          durationValue: cM,
          ...targetsOrOpen(easyP),
        });
      }
      if (out.length > 0) return out;
    }

    const usesConfigurableMp =
      (entry.mpTotalMiles != null && entry.mpTotalMiles > 0) ||
      (entry.mpFraction != null && entry.mpFraction > 0) ||
      isMpSimulationAnchor(entry.paceAnchor);

    if (!usesConfigurableMp) {
      return [
        {
          stepOrder: 1,
          title: "Long Run",
          durationType: "DISTANCE",
          durationValue: round(totalMiles, 2),
          ...targetsOrOpen(longP),
        },
      ];
    }

    let mpM: number;
    if (entry.mpTotalMiles != null && entry.mpTotalMiles > 0) {
      mpM = round(Math.min(entry.mpTotalMiles, totalMiles * 0.9), 2);
    } else {
      const peakFrac =
        entry.mpFraction != null && entry.mpFraction > 0 ? entry.mpFraction : 0.35;
      mpM = round(totalMiles * effectiveMpFraction(peakFrac, planCycleIndex), 2);
    }
    mpM = Math.min(mpM, round(totalMiles * 0.9, 2));
    mpM = Math.max(0.25, mpM);
    const easyRemain = round(Math.max(0.25, totalMiles - mpM), 2);

    const pos = (entry.mpBlockPosition ?? "BACK_HALF").toUpperCase();
    let order = 1;
    const out: ApiSegment[] = [];

    const pushEasy = (miles: number, title: string) => {
      if (miles <= 0.05) return;
      out.push({
        stepOrder: order++,
        title,
        durationType: "DISTANCE",
        durationValue: round(miles, 2),
        ...targetsOrOpen(longP),
      });
    };
    const pushMp = (miles: number) => {
      out.push({
        stepOrder: order++,
        title: "Goal marathon pace",
        durationType: "DISTANCE",
        durationValue: round(miles, 2),
        targets: [paceTargetFromSecondsPerMile(mpP)],
      });
    };

    if (pos === "FRONT_HALF") {
      pushMp(mpM);
      pushEasy(easyRemain, "Long Run");
      return out;
    }
    if (pos === "EVEN") {
      const half = round(easyRemain / 2, 2);
      const second = round(easyRemain - half, 2);
      pushEasy(half, "Long Run");
      pushMp(mpM);
      pushEasy(second, "Long Run");
      return out;
    }
    pushEasy(easyRemain, "Long Run");
    pushMp(mpM);
    return out;
  }

  if (type === "Tempo") {
    const tj = entry.segmentPaceDist;
    const tempoBlockRepeat = parseTempoBlockRepeatPayload(tj);
    if (tempoBlockRepeat) {
      const warmupM =
        entry.warmupMiles != null && entry.warmupMiles > 0 ? round(entry.warmupMiles, 2) : 0;
      const cooldownM =
        entry.cooldownMiles != null && entry.cooldownMiles > 0 ? round(entry.cooldownMiles, 2) : 0;
      const easyP = secPerMile(anchorSecondsPerMile, entry.warmupPaceOffsetSecPerMile);
      const recPace = secPerMile(anchorSecondsPerMile, entry.recoveryPaceOffsetSecPerMile);
      const repeatCount = Math.max(1, tempoBlockRepeat.repeatCount);
      const recSec = tempoBlockRepeat.recoveryBetweenCyclesSeconds;
      const recMinutes =
        recSec != null && recSec > 0 ? round(recSec / 60, 4) : null;

      let order = 1;
      const out: ApiSegment[] = [];
      if (warmupM > 0) {
        out.push({
          stepOrder: order++,
          title: "Warmup",
          durationType: "DISTANCE",
          durationValue: warmupM,
          ...targetsOrOpen(easyP),
        });
      }
      for (let c = 0; c < repeatCount; c++) {
        for (const seg of tempoBlockRepeat.segments) {
          const tp = secPerMile(anchorSecondsPerMile, seg.paceOffsetSecPerMile);
          out.push({
            stepOrder: order++,
            title: "Tempo",
            durationType: "DISTANCE",
            durationValue: seg.miles,
            ...targetsOrOpen(tp),
          });
        }
        if (c < repeatCount - 1 && recMinutes != null && recMinutes > 0) {
          out.push({
            stepOrder: order++,
            title: "Recovery",
            durationType: "TIME",
            durationValue: recMinutes,
            ...targetsOrOpen(recPace),
          });
        }
      }
      if (cooldownM > 0) {
        const cp = secPerMile(anchorSecondsPerMile, entry.cooldownPaceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Cooldown",
          durationType: "DISTANCE",
          durationValue: cooldownM,
          ...targetsOrOpen(cp),
        });
      }
      if (out.length > 0) return out;
    }

    if (isMilesWorkSegmentList(tj)) {
      const warmupM = entry.warmupMiles != null && entry.warmupMiles > 0 ? round(entry.warmupMiles, 2) : 0;
      const cooldownM =
        entry.cooldownMiles != null && entry.cooldownMiles > 0 ? round(entry.cooldownMiles, 2) : 0;
      const easyP = secPerMile(anchorSecondsPerMile, entry.warmupPaceOffsetSecPerMile);
      let order = 1;
      const out: ApiSegment[] = [];
      if (warmupM > 0) {
        out.push({
          stepOrder: order++,
          title: "Warmup",
          durationType: "DISTANCE",
          durationValue: warmupM,
          ...targetsOrOpen(easyP),
        });
      }
      let sumSeg = 0;
      for (const seg of tj) {
        const m = round(Math.max(0, Number(seg.miles)), 2);
        if (m <= 0) continue;
        const repsRaw = (seg as { reps?: unknown }).reps;
        const reps = Math.max(1, Math.round(Number(repsRaw) || 1));
        const tp = secPerMile(
          anchorSecondsPerMile,
          (seg as { paceOffsetSecPerMile?: number | null }).paceOffsetSecPerMile
        );
        for (let r = 0; r < reps; r++) {
          sumSeg += m;
          out.push({
            stepOrder: order++,
            title: "Tempo",
            durationType: "DISTANCE",
            durationValue: m,
            ...targetsOrOpen(tp),
          });
        }
      }
      const remain = round(
        Math.max(0, totalMiles - warmupM - cooldownM - sumSeg),
        2
      );
      if (remain > 0.05) {
        const mainP = secPerMile(anchorSecondsPerMile, entry.workPaceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Tempo",
          durationType: "DISTANCE",
          durationValue: remain,
          ...targetsOrOpen(mainP),
        });
      }
      if (cooldownM > 0) {
        const cp = secPerMile(anchorSecondsPerMile, entry.cooldownPaceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Cooldown",
          durationType: "DISTANCE",
          durationValue: cooldownM,
          ...targetsOrOpen(cp),
        });
      }
      if (out.length > 0) return out;
    }
    return buildSustainedQualityBlock({
      entry,
      totalMiles,
      anchorSecondsPerMile,
      title: "Tempo",
    });
  }

  if (type === "Intervals") {
    const ij = entry.segmentPaceDist;
    const blockRepeat = parseIntervalBlockRepeatPayload(ij);
    if (blockRepeat) {
      const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
      const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
      const recPace = secPerMile(anchorSecondsPerMile, entry.recoveryPaceOffsetSecPerMile);
      const easyP = secPerMile(anchorSecondsPerMile, entry.warmupPaceOffsetSecPerMile);
      const repeatCount = Math.max(1, blockRepeat.repeatCount);
      const recSec = blockRepeat.recoveryBetweenCyclesSeconds;
      const recMinutes =
        recSec != null && recSec > 0 ? round(recSec / 60, 4) : null;

      let order = 1;
      const out: ApiSegment[] = [];
      if (warmupM > 0) {
        out.push({
          stepOrder: order++,
          title: "Warmup",
          durationType: "DISTANCE",
          durationValue: warmupM,
          ...targetsOrOpen(easyP),
        });
      }
      for (let c = 0; c < repeatCount; c++) {
        for (const seg of blockRepeat.segments) {
          const intP = secPerMile(anchorSecondsPerMile, seg.paceOffsetSecPerMile);
          out.push({
            stepOrder: order++,
            title: "Interval",
            durationType: "DISTANCE",
            durationValue: round(seg.distanceMeters / 1609.34, 3),
            ...targetsOrOpen(intP),
          });
        }
        if (c < repeatCount - 1 && recMinutes != null && recMinutes > 0) {
          out.push({
            stepOrder: order++,
            title: "Recovery",
            durationType: "TIME",
            durationValue: recMinutes,
            ...targetsOrOpen(recPace),
          });
        }
      }
      if (cooldownM > 0) {
        const cp = secPerMile(anchorSecondsPerMile, entry.cooldownPaceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Cooldown",
          durationType: "DISTANCE",
          durationValue: cooldownM,
          ...targetsOrOpen(cp),
        });
      }
      if (out.length > 0) return out;
    }

    if (isIntervalWorkSegmentList(ij)) {
      const flatRepRecovery = betweenRepRecoveryForMaterialization({
        recoveryDurationSeconds: entry.recoveryDurationSeconds,
        recoveryDistanceMeters: entry.recoveryDistanceMeters,
      });
      const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
      const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
      const recPace = secPerMile(anchorSecondsPerMile, entry.recoveryPaceOffsetSecPerMile);
      const easyP = secPerMile(anchorSecondsPerMile, entry.warmupPaceOffsetSecPerMile);
      const flat: { dm: number; off: number | null | undefined }[] = [];
      for (const seg of ij) {
        const n = Math.max(1, Math.round(seg.reps ?? 1));
        for (let r = 0; r < n; r++) {
          const row = seg as { distanceMeters: number; paceOffsetSecPerMile?: number | null };
          flat.push({ dm: row.distanceMeters, off: row.paceOffsetSecPerMile });
        }
      }
      let order = 1;
      const out: ApiSegment[] = [];
      if (warmupM > 0) {
        out.push({
          stepOrder: order++,
          title: "Warmup",
          durationType: "DISTANCE",
          durationValue: warmupM,
          ...targetsOrOpen(easyP),
        });
      }
      for (let i = 0; i < flat.length; i++) {
        if (i > 0) {
          order = appendBetweenRepRecoveryStep(out, order, flatRepRecovery, recPace);
        }
        const intP = secPerMile(anchorSecondsPerMile, flat[i]!.off);
        out.push({
          stepOrder: order++,
          title: "Interval",
          durationType: "DISTANCE",
          durationValue: round(flat[i]!.dm / 1609.34, 3),
          ...targetsOrOpen(intP),
        });
      }
      if (cooldownM > 0) {
        const cp = secPerMile(anchorSecondsPerMile, entry.cooldownPaceOffsetSecPerMile);
        out.push({
          stepOrder: order++,
          title: "Cooldown",
          durationType: "DISTANCE",
          durationValue: cooldownM,
          ...targetsOrOpen(cp),
        });
      }
      return out;
    }
  }

  if (type === "Race") {
    const pace = secPerMile(anchorSecondsPerMile, entry.workPaceOffsetSecPerMile);
    return [
      {
        stepOrder: 1,
        title: "Race",
        durationType: "DISTANCE",
        durationValue: round(totalMiles, 2),
        ...targetsOrOpen(pace),
      },
    ];
  }

  const reps = entry.workBaseReps ?? 6;
  const repMiles = (entry.workBaseRepMeters ?? 800) / 1609.34;
  const legacyRepRecovery = betweenRepRecoveryForMaterialization({
    recoveryDurationSeconds: entry.recoveryDurationSeconds,
    recoveryDistanceMeters: entry.recoveryDistanceMeters,
  });
  const warmupM = entry.warmupMiles ?? round(totalMiles * 0.15, 2);
  const cooldownM = entry.cooldownMiles ?? round(totalMiles * 0.15, 2);
  const intPace = secPerMile(anchorSecondsPerMile, entry.workBasePaceOffsetSecPerMile);
  const recPace = secPerMile(anchorSecondsPerMile, entry.recoveryPaceOffsetSecPerMile);
  const easyP = secPerMile(anchorSecondsPerMile, entry.warmupPaceOffsetSecPerMile);

  let order = 1;
  const out: ApiSegment[] = [];
  if (warmupM > 0) {
    out.push({
      stepOrder: order++,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: warmupM,
      ...targetsOrOpen(easyP),
    });
  }
  for (let i = 0; i < reps; i++) {
    out.push({
      stepOrder: order++,
      title: "Interval",
      durationType: "DISTANCE",
      durationValue: round(repMiles, 3),
      ...targetsOrOpen(intPace),
    });
    order = appendBetweenRepRecoveryStep(out, order, legacyRepRecovery, recPace);
  }
  if (cooldownM > 0) {
    const cp = secPerMile(anchorSecondsPerMile, entry.cooldownPaceOffsetSecPerMile);
    out.push({
      stepOrder: order++,
      title: "Cooldown",
      durationType: "DISTANCE",
      durationValue: cooldownM,
      ...targetsOrOpen(cp),
    });
  }
  return out;
}
