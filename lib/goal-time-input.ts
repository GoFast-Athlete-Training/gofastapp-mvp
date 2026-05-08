/** Shared goal finish-time parsing / validation for GoalSetter and InlineGoalForm. */

const DISTANCE_OPTIONS = [
  { label: "5K", value: "5k" },
  { label: "10K", value: "10k" },
  { label: "10 Mile", value: "10m" },
  { label: "Half", value: "half" },
  { label: "Marathon", value: "marathon" },
  { label: "Ultra", value: "ultra" },
] as const;

export function normalizeDistanceToValue(stored: string): string {
  const s = stored.trim().toLowerCase();
  for (const opt of DISTANCE_OPTIONS) {
    if (s === opt.value) return opt.value;
  }
  if (/\b8\s*k\b|^8k|^8\s*k$/i.test(s) || s.includes("8k")) return "8k";
  if (s.includes("10") && (s.includes("mile") || s === "10m")) return "10m";
  if (s.includes("half")) return "half";
  if (s.includes("marathon") && !s.includes("half")) return "marathon";
  if (s.includes("ultra")) return "ultra";
  if (s.includes("10k") || s === "10 k") return "10k";
  if (s.includes("5k") || s === "5 k") return "5k";
  return "5k";
}

export function distanceDisplayLabel(distanceValue: string): string {
  const opt = DISTANCE_OPTIONS.find((o) => o.value === distanceValue);
  return opt?.label ?? distanceValue;
}

function isMarathonOrHalfKey(key: string): boolean {
  return key === "marathon" || key === "half";
}

/**
 * Use HH:MM:SS for half marathon and longer (by label or distance in meters).
 */
export function isLongRaceGoalTimeFormat(
  distanceLabel: string | null | undefined,
  distanceMeters: number | null | undefined
): boolean {
  if (distanceMeters != null && Number.isFinite(distanceMeters) && distanceMeters > 0) {
    return distanceMeters >= 21097.5;
  }
  const k = normalizeDistanceToValue(distanceLabel ?? "");
  return isMarathonOrHalfKey(k);
}

export function parseGoalTimeToParts(goalTime: string | null | undefined): {
  h: string;
  m: string;
  s: string;
} {
  const t = goalTime?.trim() ?? "";
  if (!t) return { h: "", m: "", s: "" };
  const parts = t.split(":");
  if (parts.length === 3) return { h: parts[0] ?? "", m: parts[1] ?? "", s: parts[2] ?? "" };
  if (parts.length === 2) return { h: "", m: parts[0] ?? "", s: parts[1] ?? "" };
  return { h: "", m: "", s: "" };
}

export type GoalTimeRaceContext = {
  distanceLabel: string | null | undefined;
  distanceMeters?: number | null | undefined;
};

export function validateAndAssembleGoalTime(
  ctx: GoalTimeRaceContext,
  h: string,
  m: string,
  s: string
):
  | { ok: true; goalTime: string | null }
  | { ok: false; message: string } {
  const allEmpty = !h.trim() && !m.trim() && !s.trim();
  if (allEmpty) return { ok: true, goalTime: null };

  const isLong = isLongRaceGoalTimeFormat(ctx.distanceLabel, ctx.distanceMeters ?? null);

  if (isLong) {
    if (!h.trim() || !m.trim() || !s.trim()) {
      return {
        ok: false,
        message:
          "Enter hours, minutes, and seconds for your goal time, or clear all fields.",
      };
    }
    const hh = parseInt(h, 10);
    const mm = parseInt(m, 10);
    const ss = parseInt(s, 10);
    if (
      [hh, mm, ss].some((n) => Number.isNaN(n)) ||
      mm >= 60 ||
      ss >= 60 ||
      hh < 0
    ) {
      return {
        ok: false,
        message: "Invalid time. Minutes and seconds must be under 60.",
      };
    }
    return {
      ok: true,
      goalTime: `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`,
    };
  }

  if (!m.trim() || !s.trim()) {
    return {
      ok: false,
      message: "Enter minutes and seconds, or clear all fields.",
    };
  }
  const mm = parseInt(m, 10);
  const ss = parseInt(s, 10);
  if (Number.isNaN(mm) || Number.isNaN(ss) || mm >= 60 || ss >= 60) {
    return {
      ok: false,
      message: "Invalid time. Minutes and seconds must be under 60.",
    };
  }
  if (h.trim() && h !== "0") {
    const hh = parseInt(h, 10);
    if (Number.isNaN(hh) || hh < 0) {
      return { ok: false, message: "Invalid hours." };
    }
    return {
      ok: true,
      goalTime: `${h.padStart(2, "0")}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`,
    };
  }
  return {
    ok: true,
    goalTime: `${m.padStart(2, "0")}:${s.padStart(2, "0")}`,
  };
}

/** One-line hint for the goal time UI (no bogus half-marathon example on a marathon card). */
export function goalTimeHelperLine(
  distanceLabel: string | null | undefined,
  distanceMeters: number | null | undefined
): string {
  const isLong = isLongRaceGoalTimeFormat(distanceLabel, distanceMeters);
  const k = normalizeDistanceToValue(distanceLabel ?? "");
  if (isLong) {
    if (k === "half") {
      return "Target finish — half marathons use hours, minutes, and seconds (e.g. 1:45:00).";
    }
    return "Target finish — marathons and longer use hours, minutes, and seconds (e.g. 3:25:00 or 4:59:30).";
  }
  if (k === "8k" || k === "10k") {
    return "Target finish — minutes and seconds (add hours only if you need them).";
  }
  return "Target finish — use minutes and seconds for short races (e.g. 22:30 for a 5K).";
}
