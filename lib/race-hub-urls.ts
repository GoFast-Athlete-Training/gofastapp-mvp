/** Canonical race hub + commitment path helpers (slug-based public URLs). */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RACE_HUB_JOIN_INTENT_KEY = "raceHubJoinIntent";
export const RACE_HUB_JOIN_INTENT_SLUG_KEY = "raceHubJoinIntentSlug";
export const RACE_HUB_RETURN_TO_KEY = "raceHubReturnTo";

export function isRaceRegistryUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function raceHubPath(slug: string): string {
  return `/race-hub/${encodeURIComponent(slug.trim())}`;
}

export function raceCommitmentPath(slug: string, returnTo?: string | null): string {
  const base = `/commitment/race/${encodeURIComponent(slug.trim())}`;
  const rt = returnTo?.trim();
  if (rt && rt.startsWith("/")) {
    return `${base}?returnTo=${encodeURIComponent(rt)}`;
  }
  return base;
}

export function raceCommitmentSignupPath(slug: string, returnTo?: string | null): string {
  const base = `/commitment/race/${encodeURIComponent(slug.trim())}/signup`;
  const rt = returnTo?.trim();
  if (rt && rt.startsWith("/")) {
    return `${base}?returnTo=${encodeURIComponent(rt)}`;
  }
  return base;
}

export function raceCommitmentConfirmPath(slug: string, returnTo?: string | null): string {
  const base = `/commitment/race/${encodeURIComponent(slug.trim())}/confirm`;
  const rt = returnTo?.trim();
  if (rt && rt.startsWith("/")) {
    return `${base}?returnTo=${encodeURIComponent(rt)}`;
  }
  return base;
}

export function resolveRaceHubReturnTo(
  returnToParam: string | null | undefined,
  slug: string
): string {
  const rt = returnToParam?.trim();
  if (rt && rt.startsWith("/race-hub/")) {
    return rt;
  }
  return raceHubPath(slug);
}

export function persistRaceHubReturnTo(returnTo: string): void {
  if (typeof window === "undefined") return;
  if (returnTo.startsWith("/")) {
    localStorage.setItem(RACE_HUB_RETURN_TO_KEY, returnTo);
  }
}

export function readRaceHubReturnTo(slug: string): string {
  if (typeof window === "undefined") return raceHubPath(slug);
  const stored = localStorage.getItem(RACE_HUB_RETURN_TO_KEY);
  if (stored?.startsWith("/race-hub/")) {
    return stored;
  }
  return raceHubPath(slug);
}

export function clearRaceHubReturnTo(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RACE_HUB_RETURN_TO_KEY);
}
