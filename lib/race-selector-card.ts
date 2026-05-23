/** Lightweight race selector card helpers for browse/discover UI. */

export function truncateText(text: string | null | undefined, maxLen: number): string {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen).trimEnd()}…`;
}

export function raceSelectorDescription(
  description: string | null | undefined,
  maxLen = 140
): string {
  const desc = description?.trim() ?? "";
  if (!desc) return "";
  return truncateText(desc, maxLen);
}

export function raceSelectorTagline(summaryPhrase: string | null | undefined): string {
  return summaryPhrase?.trim() ?? "";
}

export type RaceSelectorFields = {
  name: string;
  raceDate: string;
  city?: string | null;
  state?: string | null;
  distanceLabel?: string | null;
  summaryPhrase?: string | null;
  description?: string | null;
  logoUrl?: string | null;
};
