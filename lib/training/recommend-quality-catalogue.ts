import { CATALOGUE_ROTATION_SLOTS } from "@/lib/training/athlete-rotation-constants";
import type { WeeklyVolumeBand } from "@/lib/training/weekly-volume-key";

export type CatalogueRecommendRow = {
  id: string;
  name: string;
  description?: string | null;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
};

export type RecommendQualityCatalogueInput = {
  catalogue: CatalogueRecommendRow[];
  templateSeedIds: string[];
  weeklyVolumeBand?: WeeklyVolumeBand | null;
  progressionAggressiveness?: string | null;
};

const AGGRESSIVE_NAME_RE =
  /\b(2-1-2|2-1|over\s*\/?\s*under|rolling|400s|800s|ladder|progression|longer|sustained)\b/i;

function structureVolume(row: CatalogueRecommendRow): number {
  const reps = row.workBaseReps ?? 0;
  const meters = row.workBaseRepMeters ?? 0;
  return reps * meters;
}

function nameAggressionScore(name: string): number {
  let score = 0;
  if (/\b2-1-2\b/i.test(name)) score += 40;
  else if (/\b2-1\b/i.test(name)) score += 25;
  if (/\bover\s*\/?\s*under\b/i.test(name)) score += 15;
  if (/\brolling\b/i.test(name)) score += 12;
  if (/\b400s?\b/i.test(name)) score += 8;
  if (/\bladder\b/i.test(name)) score += 10;
  if (/\blonger\b/i.test(name) || /\bsustained\b/i.test(name)) score += 6;
  if (AGGRESSIVE_NAME_RE.test(name)) score += 4;
  if (/\bsteady\b/i.test(name)) score -= 5;
  if (/\beasy\b/i.test(name)) score -= 8;
  return score;
}

function scoreRow(row: CatalogueRecommendRow): number {
  const vol = structureVolume(row);
  const volScore = vol > 0 ? Math.min(30, Math.log10(vol + 1) * 8) : 0;
  return volScore + nameAggressionScore(row.name);
}

function targetPickCount(input: RecommendQualityCatalogueInput): number {
  const band = input.weeklyVolumeBand;
  const agg = (input.progressionAggressiveness ?? "MODERATE").toUpperCase();

  if (band === "ELITE" || agg === "AMBITIOUS") return CATALOGUE_ROTATION_SLOTS;
  if (band === "FINISH" || agg === "CONSERVATIVE") {
    const templateLen = input.templateSeedIds.filter(Boolean).length;
    return Math.min(CATALOGUE_ROTATION_SLOTS, Math.max(4, templateLen || 4));
  }
  // RACE / MODERATE — fill toward 8 from template, at least template size
  const templateLen = input.templateSeedIds.filter(Boolean).length;
  return Math.min(CATALOGUE_ROTATION_SLOTS, Math.max(templateLen || 6, 6));
}

/**
 * Returns catalogue IDs recommended for the athlete's band (up to 8).
 * Template seed IDs are always included first; remaining slots filled by score.
 */
export function recommendQualityCatalogueIds(
  input: RecommendQualityCatalogueInput
): string[] {
  const target = targetPickCount(input);
  const byId = new Map(input.catalogue.map((c) => [c.id, c]));
  const picked: string[] = [];

  for (const id of input.templateSeedIds) {
    if (id?.trim() && byId.has(id) && !picked.includes(id)) {
      picked.push(id);
    }
  }

  const remaining = input.catalogue
    .filter((c) => !picked.includes(c.id))
    .slice()
    .sort((a, b) => scoreRow(b) - scoreRow(a));

  for (const row of remaining) {
    if (picked.length >= target) break;
    picked.push(row.id);
  }

  return picked.slice(0, CATALOGUE_ROTATION_SLOTS);
}

export function isRecommendedCatalogueId(
  recommendedIds: string[],
  catalogueId: string
): boolean {
  return recommendedIds.includes(catalogueId);
}
