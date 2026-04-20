/**
 * Human-readable pace vs target range for workout/activity result UIs.
 */

export function paceRangeBounds(
  low: number | null | undefined,
  high: number | null | undefined
): { lo: number; hi: number } | null {
  if (low == null && high == null) return null;
  if (low != null && high != null) {
    return { lo: Math.min(low, high), hi: Math.max(low, high) };
  }
  const v = low ?? high;
  if (v == null || !Number.isFinite(v)) return null;
  return { lo: v, hi: v };
}

export type PaceVsTargetLabel = "in_range" | "faster" | "slower" | "unknown";

export function paceVsTargetLabel(
  actualSecPerMile: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined
): PaceVsTargetLabel {
  if (actualSecPerMile == null || !Number.isFinite(actualSecPerMile)) return "unknown";
  const b = paceRangeBounds(low, high);
  if (!b) return "unknown";
  if (actualSecPerMile < b.lo) return "faster";
  if (actualSecPerMile > b.hi) return "slower";
  return "in_range";
}

/** Short label for badge (e.g. results hero). */
export function paceVsTargetBadgeText(label: PaceVsTargetLabel): string {
  switch (label) {
    case "in_range":
      return "In range";
    case "faster":
      return "Faster than target";
    case "slower":
      return "Slower than target";
    default:
      return "—";
  }
}

/**
 * One-line delta vs range (or single target via high === low).
 */
export function paceRangeDeltaMessage(
  actualSecPerMile: number | null | undefined,
  low: number | null | undefined,
  high: number | null | undefined
): string | null {
  if (actualSecPerMile == null || !Number.isFinite(actualSecPerMile)) return null;
  const b = paceRangeBounds(low, high);
  if (!b) return null;
  const label = paceVsTargetLabel(actualSecPerMile, low, high);
  if (label === "in_range") return "In range";
  if (label === "faster") {
    const secs = Math.round(b.lo - actualSecPerMile);
    return `${secs}s/mi faster than target`;
  }
  if (label === "slower") {
    const secs = Math.round(actualSecPerMile - b.hi);
    return `${secs}s/mi slower than target`;
  }
  return null;
}

function formatSecPerMileUi(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")} /mi`;
}

/** e.g. 8:15–8:45 /mi when both bounds exist. */
export function formatPaceTargetRangeDisplay(
  low: number | null | undefined,
  high: number | null | undefined
): string | null {
  const b = paceRangeBounds(low, high);
  if (!b) return null;
  const a = formatSecPerMileUi(b.lo);
  const hi = formatSecPerMileUi(b.hi);
  if (b.lo === b.hi) return a;
  const aShort = a.replace(/\s*\/mi\s*$/, "").trim();
  const hiShort = hi.replace(/\s*\/mi\s*$/, "").trim();
  return `${aShort}–${hiShort} /mi`;
}

/** When only a single target pace exists (no range). */
export function singleTargetPaceDeltaMessage(
  paceDeltaSecPerMile: number | null | undefined
): string | null {
  if (paceDeltaSecPerMile == null || !Number.isFinite(paceDeltaSecPerMile)) return null;
  if (paceDeltaSecPerMile > 0) {
    return `${Math.round(paceDeltaSecPerMile)}s/mi faster than target`;
  }
  if (paceDeltaSecPerMile < 0) {
    return `${Math.abs(Math.round(paceDeltaSecPerMile))}s/mi slower than target`;
  }
  return "On target";
}
