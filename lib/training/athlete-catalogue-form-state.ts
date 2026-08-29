/**
 * Athlete catalogue mutation form state — init from AI prefill + build save payload.
 * Ported from GoFastCompany CatalogueEditForm (Tempo / Intervals only).
 */

import { normalizeTrainingIntentArray } from "@/lib/training/catalogue-training-intents";
import {
  segmentPayloadFromMetersRow,
  segmentPayloadFromMilesRow,
} from "@/lib/training/pace-key-catalogue";

export type MilesSeg = { miles: string; paceKey?: string; pace: string };
export type IntSeg = { distanceMeters: string; paceKey?: string; pace: string; reps: string };
export type IntBlockSeg = { distanceMeters: string; paceKey?: string; pace: string };

export type AthleteCatalogueFormState = {
  name: string;
  runSubType: string;
  description: string;
  workoutType: "Tempo" | "Intervals";
  paceAnchor: string;
  warmupMiles: string;
  warmupPaceOffsetSecPerMile: string;
  cooldownMiles: string;
  cooldownPaceOffsetSecPerMile: string;
  workPaceOffsetSecPerMile: string;
  workBaseMiles: string;
  workBasePaceOffsetSecPerMile: string;
  recoveryDistanceMeters: string;
  recoveryDurationSeconds: string;
  recoveryPaceOffsetSecPerMile: string;
  warmupFractionPct: string;
  workFractionPct: string;
  cooldownFractionPct: string;
  tempo5kMode: "simple" | "segments" | "blockRepeat";
  tempoMilesSegs: MilesSeg[];
  tempoBlockSegs: MilesSeg[];
  tempoBlockRepeatCount: string;
  tempoBlockRecoverySec: string;
  intervalMode: "flat" | "blockRepeat";
  intervalSegs: IntSeg[];
  intervalBlockSegs: IntBlockSeg[];
  intervalBlockRepeatCount: string;
  intervalBlockRecoverySec: string;
  noWarmup: boolean;
  noCooldown: boolean;
  purpose: string;
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function pct(f: number | null | undefined): string {
  if (f == null || !Number.isFinite(f)) return "";
  return String(Math.round(f * 1000) / 10);
}

function pctToFrac(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / 100;
}

function normalizeSegmentJsonFromDb(raw: unknown): unknown {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (t === "" || t === "null") return undefined;
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
}

function segmentPaceDistFromPrefill(p: Record<string, unknown> | null | undefined): unknown {
  const raw = p?.segmentPaceDist ?? p?.segmentPatternJson ?? p?.workSegmentsJson;
  return normalizeSegmentJsonFromDb(raw);
}

function milesSegsFromJson(raw: unknown): MilesSeg[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ miles: "", paceKey: "", pace: "" }];
  return raw.map((r) => {
    const o = r as { miles?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown };
    return {
      miles: o.miles != null ? String(o.miles) : "",
      paceKey: o.paceKey != null ? String(o.paceKey) : "",
      pace: o.paceOffsetSecPerMile != null ? String(o.paceOffsetSecPerMile) : "",
    };
  });
}

function tempoBlockRepeatStateFromJson(raw: unknown): {
  tempoBlockSegs: MilesSeg[];
  tempoBlockRepeatCount: string;
  tempoBlockRecoverySec: string;
} {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      tempoBlockSegs: [{ miles: "", paceKey: "", pace: "" }],
      tempoBlockRepeatCount: "1",
      tempoBlockRecoverySec: "",
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.layout !== "blockRepeat") {
    return {
      tempoBlockSegs: [{ miles: "", paceKey: "", pace: "" }],
      tempoBlockRepeatCount: "1",
      tempoBlockRecoverySec: "",
    };
  }
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const tempoBlockSegs: MilesSeg[] =
    segs.length > 0
      ? segs.map((r) => {
          const row = r as { miles?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown };
          return {
            miles: row.miles != null ? String(row.miles) : "",
            paceKey: row.paceKey != null ? String(row.paceKey) : "",
            pace: row.paceOffsetSecPerMile != null ? String(row.paceOffsetSecPerMile) : "",
          };
        })
      : [{ miles: "", paceKey: "", pace: "" }];
  return {
    tempoBlockSegs,
    tempoBlockRepeatCount:
      o.repeatCount != null && String(o.repeatCount) !== "" ? String(o.repeatCount) : "1",
    tempoBlockRecoverySec:
      o.recoveryBetweenCyclesSeconds != null ? String(o.recoveryBetweenCyclesSeconds) : "",
  };
}

function intervalBlockRepeatStateFromJson(raw: unknown): {
  intervalBlockSegs: IntBlockSeg[];
  intervalBlockRepeatCount: string;
  intervalBlockRecoverySec: string;
} {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      intervalBlockSegs: [{ distanceMeters: "", paceKey: "", pace: "" }],
      intervalBlockRepeatCount: "1",
      intervalBlockRecoverySec: "",
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.layout !== "blockRepeat") {
    return {
      intervalBlockSegs: [{ distanceMeters: "", paceKey: "", pace: "" }],
      intervalBlockRepeatCount: "1",
      intervalBlockRecoverySec: "",
    };
  }
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const intervalBlockSegs: IntBlockSeg[] =
    segs.length > 0
      ? segs.map((r) => {
          const row = r as { distanceMeters?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown };
          return {
            distanceMeters: row.distanceMeters != null ? String(row.distanceMeters) : "",
            paceKey: row.paceKey != null ? String(row.paceKey) : "",
            pace: row.paceOffsetSecPerMile != null ? String(row.paceOffsetSecPerMile) : "",
          };
        })
      : [{ distanceMeters: "", paceKey: "", pace: "" }];
  return {
    intervalBlockSegs,
    intervalBlockRepeatCount:
      o.repeatCount != null && String(o.repeatCount) !== "" ? String(o.repeatCount) : "1",
    intervalBlockRecoverySec:
      o.recoveryBetweenCyclesSeconds != null ? String(o.recoveryBetweenCyclesSeconds) : "",
  };
}

function intervalSegsFromPrefill(p: Record<string, unknown> | null | undefined): IntSeg[] {
  const j = segmentPaceDistFromPrefill(p);
  if (j != null && typeof j === "object" && !Array.isArray(j)) {
    const o = j as Record<string, unknown>;
    if (o.layout === "blockRepeat") {
      return [{ distanceMeters: "", paceKey: "", pace: "", reps: "1" }];
    }
  }
  if (Array.isArray(j) && j.length > 0) {
    return j.map((r) => {
      const o = r as { distanceMeters?: unknown; paceOffsetSecPerMile?: unknown; paceKey?: unknown; reps?: unknown };
      return {
        distanceMeters: o.distanceMeters != null ? String(o.distanceMeters) : "",
        paceKey: o.paceKey != null ? String(o.paceKey) : "",
        pace: o.paceOffsetSecPerMile != null ? String(o.paceOffsetSecPerMile) : "",
        reps: o.reps != null ? String(o.reps) : "1",
      };
    });
  }
  if (p?.workBaseRepMeters != null || p?.workBaseReps != null) {
    return [
      {
        distanceMeters: str(p.workBaseRepMeters),
        pace: str(p.workBasePaceOffsetSecPerMile ?? p.repPaceOffsetSecPerMile),
        paceKey: "",
        reps: str(p.workBaseReps) || "1",
      },
    ];
  }
  return [{ distanceMeters: "", paceKey: "", pace: "", reps: "1" }];
}

function initNoWarmup(p: Record<string, unknown> | null | undefined): boolean {
  const rawM = p?.warmupMiles;
  if (rawM === 0 || rawM === "0") return true;
  const wm = str(rawM);
  const wo = str(p?.warmupPaceOffsetSecPerMile);
  return wm === "" && wo === "";
}

function initNoCooldown(p: Record<string, unknown> | null | undefined): boolean {
  const rawM = p?.cooldownMiles;
  if (rawM === 0 || rawM === "0") return true;
  const cm = str(rawM);
  const co = str(p?.cooldownPaceOffsetSecPerMile);
  return cm === "" && co === "";
}

function initPurposeText(p: Record<string, unknown> | null | undefined): string {
  if (typeof p?.purpose === "string" && p.purpose.trim()) return p.purpose.trim();
  if (Array.isArray(p?.trainingIntent)) {
    return (p.trainingIntent as unknown[])
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function initAthleteCatalogueFormState(
  aiPrefill: Record<string, unknown> | null | undefined,
  lockedWorkoutType: "Tempo" | "Intervals"
): AthleteCatalogueFormState {
  const p = aiPrefill ?? {};
  const wf = p.warmupFraction;
  const wff = p.workFraction;
  const cff = p.cooldownFraction;
  const wj = segmentPaceDistFromPrefill(p);

  const tempo5kMode = (() => {
    if (lockedWorkoutType !== "Tempo") return "simple" as const;
    if (wj != null && typeof wj === "object" && !Array.isArray(wj)) {
      const o = wj as Record<string, unknown>;
      if (o.layout === "blockRepeat") return "blockRepeat" as const;
    }
    if (Array.isArray(wj) && wj.length > 0) {
      const first = wj[0] as { miles?: unknown };
      if (first && typeof first === "object" && "miles" in first) return "segments" as const;
    }
    return "simple" as const;
  })();

  const intervalMode = (() => {
    if (lockedWorkoutType !== "Intervals") return "flat" as const;
    if (wj != null && typeof wj === "object" && !Array.isArray(wj)) {
      const o = wj as Record<string, unknown>;
      if (o.layout === "blockRepeat") return "blockRepeat" as const;
    }
    return "flat" as const;
  })();

  const tempoBlock = lockedWorkoutType === "Tempo" ? tempoBlockRepeatStateFromJson(wj) : null;
  const intervalBlock =
    lockedWorkoutType === "Intervals" ? intervalBlockRepeatStateFromJson(wj) : null;

  return {
    name: str(p.name),
    runSubType: str(p.runSubType),
    description: str(p.description),
    workoutType: lockedWorkoutType,
    paceAnchor: str(p.paceAnchor) || "currentBuildup",
    warmupMiles: str(p.warmupMiles),
    warmupPaceOffsetSecPerMile: str(p.warmupPaceOffsetSecPerMile),
    cooldownMiles: str(p.cooldownMiles),
    cooldownPaceOffsetSecPerMile: str(p.cooldownPaceOffsetSecPerMile),
    workPaceOffsetSecPerMile: str(
      p.workPaceOffsetSecPerMile ?? p.overallPaceOffsetSecPerMile
    ),
    workBaseMiles: str(p.workBaseMiles),
    workBasePaceOffsetSecPerMile: str(
      p.workBasePaceOffsetSecPerMile ?? p.repPaceOffsetSecPerMile
    ),
    recoveryDistanceMeters: str(p.recoveryDistanceMeters),
    recoveryDurationSeconds: str(
      p.recoveryDurationSeconds ?? p.recoveryBetweenRepsSeconds
    ),
    recoveryPaceOffsetSecPerMile: str(p.recoveryPaceOffsetSecPerMile),
    warmupFractionPct: pct(wf as number | null | undefined),
    workFractionPct: pct(wff as number | null | undefined),
    cooldownFractionPct: pct(cff as number | null | undefined),
    tempo5kMode,
    tempoMilesSegs:
      lockedWorkoutType === "Tempo" ? milesSegsFromJson(wj) : [{ miles: "", paceKey: "", pace: "" }],
    tempoBlockSegs: tempoBlock?.tempoBlockSegs ?? [{ miles: "", paceKey: "", pace: "" }],
    tempoBlockRepeatCount: tempoBlock?.tempoBlockRepeatCount ?? "1",
    tempoBlockRecoverySec: tempoBlock?.tempoBlockRecoverySec ?? "",
    intervalMode,
    intervalSegs: intervalSegsFromPrefill(p),
    intervalBlockSegs: intervalBlock?.intervalBlockSegs ?? [{ distanceMeters: "", paceKey: "", pace: "" }],
    intervalBlockRepeatCount: intervalBlock?.intervalBlockRepeatCount ?? "1",
    intervalBlockRecoverySec: intervalBlock?.intervalBlockRecoverySec ?? "",
    noWarmup: initNoWarmup(p),
    noCooldown: initNoCooldown(p),
    purpose: initPurposeText(p),
  };
}

function n(v: string): number | undefined {
  if (v === "" || v == null) return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
}

function ni(v: string): number | undefined {
  const x = n(v);
  return x === undefined ? undefined : Math.round(x);
}

function buildSegmentPaceDistance(form: AthleteCatalogueFormState): unknown {
  const w = form.workoutType;
  if (w === "Tempo" && form.tempo5kMode === "blockRepeat") {
    const arr = form.tempoBlockSegs
      .map((r) => segmentPayloadFromMilesRow(r))
      .filter((r) => Object.keys(r).length > 0);
    if (!arr.length) return null;
    const repeatCount = Math.max(1, Math.round(Number(form.tempoBlockRepeatCount) || 1));
    const recSec = Number(form.tempoBlockRecoverySec);
    const out: Record<string, unknown> = {
      layout: "blockRepeat",
      segments: arr,
      repeatCount,
    };
    if (Number.isFinite(recSec) && recSec > 0) {
      out.recoveryBetweenCyclesSeconds = Math.round(recSec);
    }
    return out;
  }
  if (w === "Tempo" && form.tempo5kMode === "segments") {
    const arr = form.tempoMilesSegs
      .map((r) => segmentPayloadFromMilesRow(r))
      .filter((r) => Object.keys(r).length > 0);
    return arr.length ? arr : null;
  }
  if (w === "Intervals") {
    if (form.intervalMode === "blockRepeat") {
      const arr = form.intervalBlockSegs
        .map((r) => segmentPayloadFromMetersRow(r))
        .filter((r) => Object.keys(r).length > 0);
      if (!arr.length) return null;
      const repeatCount = Math.max(1, Math.round(Number(form.intervalBlockRepeatCount) || 1));
      const recSec = Number(form.intervalBlockRecoverySec);
      const out: Record<string, unknown> = {
        layout: "blockRepeat",
        segments: arr,
        repeatCount,
      };
      if (Number.isFinite(recSec) && recSec > 0) {
        out.recoveryBetweenCyclesSeconds = Math.round(recSec);
      }
      return out;
    }
    const arr = form.intervalSegs
      .map((r) => segmentPayloadFromMetersRow(r))
      .filter((r) => Object.keys(r).length > 0);
    return arr.length ? arr : null;
  }
  return null;
}

/** Build bodyToCatalogueRow-compatible payload from form state. */
export function buildAthleteCataloguePayload(
  form: AthleteCatalogueFormState
): Record<string, unknown> {
  const wt = form.workoutType;
  const is5K = form.paceAnchor === "currentBuildup";
  const isMP = form.paceAnchor === "mpSimulation";

  const wjsonBuilt = buildSegmentPaceDistance(form);
  const wjson = wt === "Tempo" && isMP ? null : wjsonBuilt;

  const body: Record<string, unknown> = {
    name: form.name.trim(),
    runSubType: form.runSubType.trim() || null,
    description: form.description.trim() || null,
    workoutType: wt,
    paceAnchor: form.paceAnchor,
    mpFraction: null,
    mpBlockPosition: null,
    mpBlockProgression: "flat",
    mpTotalMiles: null,
    segmentPaceDist: wjson,
    warmupFraction: null,
    workFraction: null,
    cooldownFraction: null,
  };

  if (isMP) {
    body.warmupFraction = pctToFrac(form.warmupFractionPct);
    body.workFraction = pctToFrac(form.workFractionPct);
    body.cooldownFraction = pctToFrac(form.cooldownFractionPct);
  }

  if (form.noWarmup) {
    body.warmupMiles = null;
    body.warmupPaceOffsetSecPerMile = null;
  } else {
    body.warmupMiles = n(form.warmupMiles) ?? null;
    body.warmupPaceOffsetSecPerMile = ni(form.warmupPaceOffsetSecPerMile) ?? null;
  }

  if (form.noCooldown) {
    body.cooldownMiles = null;
    body.cooldownPaceOffsetSecPerMile = null;
  } else {
    body.cooldownMiles = n(form.cooldownMiles) ?? null;
    body.cooldownPaceOffsetSecPerMile = ni(form.cooldownPaceOffsetSecPerMile) ?? null;
  }

  body.workPaceOffsetSecPerMile = ni(form.workPaceOffsetSecPerMile) ?? null;
  body.workBaseMiles = n(form.workBaseMiles) ?? null;
  body.workBasePaceOffsetSecPerMile = ni(form.workBasePaceOffsetSecPerMile) ?? null;
  body.recoveryDistanceMeters = ni(form.recoveryDistanceMeters) ?? null;
  body.recoveryDurationSeconds = ni(form.recoveryDurationSeconds) ?? null;
  body.recoveryPaceOffsetSecPerMile = ni(form.recoveryPaceOffsetSecPerMile) ?? null;
  body.mpPaceOffsetSecPerMile = isMP ? null : ni(form.workPaceOffsetSecPerMile) ?? null;
  body.trainingIntent = normalizeTrainingIntentArray(
    form.purpose
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if (wt === "Tempo" && form.tempo5kMode === "simple") {
    body.segmentPaceDist = null;
  }

  if (wt === "Intervals") {
    if (wjson) {
      body.workBaseReps = null;
      body.workBaseRepMeters = null;
    } else {
      const first = form.intervalSegs[0];
      body.workBaseReps = first?.reps != null && first.reps !== "" ? ni(first.reps) : null;
      body.workBaseRepMeters =
        first?.distanceMeters != null && first.distanceMeters !== ""
          ? ni(first.distanceMeters)
          : null;
    }
  }

  return body;
}
