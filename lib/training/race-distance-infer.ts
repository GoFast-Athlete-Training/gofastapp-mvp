import { COMMON_RACE_DISTANCE_PRESETS } from "@/lib/training/race-distance-presets";

const MI_TO_M = 1609.344;
const MARATHON_M = 42195;
const HALF_MARATHON_M = 21098;

function buildAliasMap(): Map<string, number> {
  const m = new Map<string, number>();
  const add = (alias: string, meters: number) => {
    const k = normalizeDistanceKey(alias);
    if (k) m.set(k, meters);
  };
  for (const p of COMMON_RACE_DISTANCE_PRESETS) {
    add(p.label, p.meters);
  }
  add("full marathon", MARATHON_M);
  add("26.2", Math.round(26.2 * MI_TO_M));
  add("26.2 mi", Math.round(26.2 * MI_TO_M));
  add("26.2 mile", Math.round(26.2 * MI_TO_M));
  add("26.2 miles", Math.round(26.2 * MI_TO_M));
  add("half marathon", HALF_MARATHON_M);
  add("half-marathon", HALF_MARATHON_M);
  add("half", HALF_MARATHON_M);
  add("hm", HALF_MARATHON_M);
  add("13.1 mi", Math.round(13.1 * MI_TO_M));
  add("5km", 5000);
  add("10km", 10000);
  return m;
}

const ALIAS_TO_METERS = buildAliasMap();

export function normalizeDistanceKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-");
}

function parseNumericUnitDistance(norm: string): number | null {
  let m = norm.match(/^(\d+(?:\.\d+)?)\s*(km)$/);
  if (m) {
    const n = Number.parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1000);
  }
  m = norm.match(/^(\d+(?:\.\d+)?)\s*k$/);
  if (m) {
    const n = Number.parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1000);
  }
  m = norm.match(/^(\d+(?:\.\d+)?)\s*(mi|mile|miles)$/);
  if (m) {
    const n = Number.parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * MI_TO_M);
  }
  return null;
}

/** Single segment (no `|`) → meters when recognized. */
export function inferDistanceMetersFromLabel(
  raw: string | null | undefined
): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.includes("|")) return null;
  const key = normalizeDistanceKey(trimmed);
  if (!key) return null;
  const fromAlias = ALIAS_TO_METERS.get(key);
  if (fromAlias != null) return fromAlias;
  const numeric = parseNumericUnitDistance(key);
  if (numeric != null) return numeric;
  return null;
}

/** Canonical preset label for a known distance string, or null. */
export function canonicalDistanceLabelFromText(
  raw: string | null | undefined
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  for (const p of COMMON_RACE_DISTANCE_PRESETS) {
    if (p.label.toLowerCase() === trimmed.toLowerCase()) return p.label;
  }
  const meters = inferDistanceMetersFromLabel(trimmed);
  if (meters == null) return null;
  const snapped = COMMON_RACE_DISTANCE_PRESETS.find(
    (p) => Math.abs(p.meters - meters) <= 300
  );
  return snapped?.label ?? null;
}

export function metersForCanonicalDistanceLabel(
  label: string | null | undefined
): number | null {
  const canonical = canonicalDistanceLabelFromText(label);
  if (!canonical) return null;
  const preset = COMMON_RACE_DISTANCE_PRESETS.find((p) => p.label === canonical);
  return preset?.meters ?? null;
}

/** Last-resort hint from race title when catalog meta is missing. */
export function inferDistanceLabelFromRaceName(
  raceName: string | null | undefined
): string | null {
  const n = normalizeDistanceKey(raceName ?? "");
  if (!n) return null;
  if (/\bhalf[\s-]?marathon\b/.test(n) || /\b13\.1\b/.test(n)) {
    return "Half Marathon";
  }
  if (/\bmarathon\b/.test(n) || /\b26\.2\b/.test(n) || /\bfull marathon\b/.test(n)) {
    return "Marathon";
  }
  if (/\b10\s*k\b|\b10k\b/.test(n)) return "10K";
  if (/\b5\s*k\b|\b5k\b/.test(n)) return "5K";
  if (/\b8\s*k\b|\b8k\b/.test(n)) return "8K";
  if (/\b15\s*k\b|\b15k\b/.test(n)) return "15K";
  if (/\b50\s*k\b|\b50k\b/.test(n)) return "50K";
  if (/\b100\s*k\b|\b100k\b/.test(n)) return "100K";
  if (/\b10\s*mile\b|\b10mi\b/.test(n)) return "10 Mile";
  if (/\bhalf\b/.test(n) && !/\bmarathon\b/.test(n)) return "Half Marathon";
  return null;
}
