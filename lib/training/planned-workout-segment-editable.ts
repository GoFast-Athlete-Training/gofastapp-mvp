import {
  normalizePaceTargetEncodingVersion,
  secondsPerMileToSecondsPerKm,
  storedPaceSecondsKmToSecondsPerMile,
} from "@/lib/workout-generator/pace-calculator";
import { parseSplitPaceToSecPerMile, secPerMileToSplitStrings } from "@/lib/workout/pace-mi-split";
import { inferSegmentKind } from "@/lib/group-workout-segment-editor";

export type PlannedWorkoutSegment = {
  id: string;
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  targets?: Array<{
    type: string;
    valueLow?: number;
    valueHigh?: number;
    value?: number;
  }>;
  repeatCount?: number | null;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
  notes?: string | null;
  paceTargetEncodingVersion?: number | null;
};

export type EditablePlannedSegment = {
  clientKey: string;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: string;
  repeatCount: string;
  recoveryDurationType: string;
  recoveryDurationValue: string;
  paceLowMin: string;
  paceLowSec: string;
  paceHighMin: string;
  paceHighSec: string;
  notes: string;
};

function segmentPaceEncoding(seg: PlannedWorkoutSegment) {
  return normalizePaceTargetEncodingVersion(seg.paceTargetEncodingVersion);
}

function newClientKey(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `k_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Always edit distance segments in miles — never convert to meters in the modify UI. */
export function formatMilesForEditInput(miles: number): string {
  if (!Number.isFinite(miles) || miles <= 0) return "";
  if (miles < 1) {
    const rounded = Math.round(miles * 1000) / 1000;
    const asStr = rounded.toFixed(3);
    return asStr.replace(/\.?0+$/, "") || "0";
  }
  const roundedTenth = Math.round(miles * 10) / 10;
  if (Math.abs(roundedTenth - Math.round(roundedTenth)) < 1e-9) {
    return String(Math.round(roundedTenth));
  }
  return roundedTenth.toFixed(1);
}

export function defaultWorkPaceBandSecPerMile(
  anchorSecPerMile: number,
  workoutType: string
): { low: number; high: number } {
  const wt = (workoutType || "").trim();
  if (wt === "Tempo") {
    const center = anchorSecPerMile + 15;
    return { low: center, high: center };
  }
  if (wt === "Interval") {
    const center = anchorSecPerMile - 10;
    return { low: center, high: center };
  }
  const center = anchorSecPerMile + 90;
  return { low: center - 16, high: center + 16 };
}

export function segmentToEditablePlanned(s: PlannedWorkoutSegment): EditablePlannedSegment {
  const enc = segmentPaceEncoding(s);
  const pace = s.targets?.find((t) => (t.type || "").toUpperCase() === "PACE");
  let paceLowMin = "";
  let paceLowSec = "";
  let paceHighMin = "";
  let paceHighSec = "";
  if (pace?.valueLow != null && Number.isFinite(Number(pace.valueLow))) {
    const lowTotal = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.valueLow), enc)
    );
    const lo = secPerMileToSplitStrings(lowTotal);
    paceLowMin = lo.min;
    paceLowSec = lo.sec;
  } else if (pace?.value != null && Number.isFinite(Number(pace.value))) {
    const lowTotal = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.value), enc)
    );
    const lo = secPerMileToSplitStrings(lowTotal);
    paceLowMin = lo.min;
    paceLowSec = lo.sec;
  }
  if (pace?.valueHigh != null && Number.isFinite(Number(pace.valueHigh))) {
    const highTotal = Math.round(
      storedPaceSecondsKmToSecondsPerMile(Number(pace.valueHigh), enc)
    );
    const hi = secPerMileToSplitStrings(highTotal);
    paceHighMin = hi.min;
    paceHighSec = hi.sec;
  }

  const durType = s.durationType === "TIME" ? "TIME" : "DISTANCE";
  const milesNum =
    durType === "DISTANCE" && Number.isFinite(s.durationValue) ? s.durationValue : 0;
  const durationValue =
    durType === "DISTANCE" ? formatMilesForEditInput(milesNum) : String(s.durationValue);

  let recoveryDurationType = "";
  let recoveryDurationValue = "";
  const rt = (s.recoveryDurationType ?? "").trim().toUpperCase();
  if (rt === "DISTANCE" || rt === "TIME") {
    recoveryDurationType = rt;
    const rv = Number(s.recoveryDurationValue);
    if (rt === "DISTANCE" && Number.isFinite(rv) && rv > 0) {
      recoveryDurationValue = formatMilesForEditInput(rv);
    } else if (rt === "TIME" && Number.isFinite(rv) && rv > 0) {
      recoveryDurationValue = String(rv);
    }
  } else if (rt === "NONE") {
    recoveryDurationType = "NONE";
  }

  return {
    clientKey: s.id?.trim() ? s.id : newClientKey(),
    title: s.title,
    durationType: durType,
    durationValue,
    repeatCount:
      s.repeatCount != null && Number(s.repeatCount) > 1 ? String(s.repeatCount) : "",
    recoveryDurationType,
    recoveryDurationValue,
    paceLowMin,
    paceLowSec,
    paceHighMin,
    paceHighSec,
    notes: s.notes ?? "",
  };
}

export function seedWorkBlockPaceIfMissing(
  editable: EditablePlannedSegment,
  segmentTitle: string,
  workoutType: string,
  fiveKSecPerMile: number | null
): EditablePlannedSegment {
  if (inferSegmentKind(segmentTitle) !== "work") return editable;
  if (editable.paceLowMin.trim() || editable.paceLowSec.trim()) return editable;
  if (fiveKSecPerMile == null || !Number.isFinite(fiveKSecPerMile)) return editable;
  const band = defaultWorkPaceBandSecPerMile(fiveKSecPerMile, workoutType);
  const lo = secPerMileToSplitStrings(band.low);
  const hi = secPerMileToSplitStrings(band.high);
  return {
    ...editable,
    paceLowMin: lo.min,
    paceLowSec: lo.sec,
    paceHighMin: hi.min,
    paceHighSec: hi.sec,
  };
}

export function editablePlannedSegmentsToApiPayload(segments: EditablePlannedSegment[]) {
  return segments.map((s, i) => {
    let durationValue: number;
    if (s.durationType === "DISTANCE") {
      const raw = parseFloat(s.durationValue);
      if (!Number.isFinite(raw) || raw < 0) {
        throw new Error(`Workout part ${i + 1}: invalid duration`);
      }
      durationValue = raw;
    } else {
      durationValue = parseFloat(s.durationValue);
      if (!Number.isFinite(durationValue) || durationValue < 0) {
        throw new Error(`Workout part ${i + 1}: invalid duration`);
      }
    }

    const title = s.title.trim();
    if (!title) {
      throw new Error(`Workout part ${i + 1}: title is required`);
    }
    let repeatCount: number | null = null;
    if (s.repeatCount.trim()) {
      const r = parseInt(s.repeatCount, 10);
      if (Number.isFinite(r) && r > 1) repeatCount = r;
    }

    let recoveryDurationType: string | null = null;
    let recoveryDurationValue: number | null = null;
    if (repeatCount != null && repeatCount > 1) {
      const rk = s.recoveryDurationType.trim().toUpperCase();
      if (rk === "DISTANCE") {
        const rv = parseFloat(s.recoveryDurationValue);
        if (Number.isFinite(rv) && rv > 0) {
          recoveryDurationType = "DISTANCE";
          recoveryDurationValue = rv;
        }
      } else if (rk === "TIME") {
        const rv = parseFloat(s.recoveryDurationValue);
        if (Number.isFinite(rv) && rv > 0) {
          recoveryDurationType = "TIME";
          recoveryDurationValue = rv;
        }
      } else if (rk === "NONE") {
        recoveryDurationType = "NONE";
        recoveryDurationValue = null;
      }
    }

    const kind = inferSegmentKind(title);
    let targets: unknown = null;
    if (kind === "work") {
      const lowSecMi = parseSplitPaceToSecPerMile(
        s.paceLowMin,
        s.paceLowSec,
        `Workout part ${i + 1}`,
        "low"
      );
      const highSecMi = parseSplitPaceToSecPerMile(
        s.paceHighMin,
        s.paceHighSec,
        `Workout part ${i + 1}`,
        "high"
      );
      const low = Number.isFinite(lowSecMi) ? secondsPerMileToSecondsPerKm(lowSecMi) : NaN;
      const high = Number.isFinite(highSecMi)
        ? secondsPerMileToSecondsPerKm(highSecMi)
        : NaN;
      if (Number.isFinite(low) && Number.isFinite(high)) {
        targets = [{ type: "PACE", valueLow: low, valueHigh: high }];
      } else if (Number.isFinite(low)) {
        targets = [{ type: "PACE", value: low }];
      }
    }

    return {
      stepOrder: i + 1,
      title,
      durationType: s.durationType,
      durationValue,
      repeatCount,
      notes: s.notes.trim() || null,
      targets,
      recoveryDurationType,
      recoveryDurationValue,
    };
  });
}

export function plannedSegmentsToEditableState(
  segments: PlannedWorkoutSegment[],
  workoutType: string,
  fiveKSecPerMile: number | null
): EditablePlannedSegment[] {
  const sorted = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  return sorted.map((s) => {
    const base = segmentToEditablePlanned(s);
    return seedWorkBlockPaceIfMissing(base, s.title, workoutType, fiveKSecPerMile);
  });
}
