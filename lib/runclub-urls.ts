/**
 * Normalize run club URLs when copying from acq_run_clubs (GoFastCompany) to run_clubs (gofastapp-mvp).
 * Prevents DC migration junk: websiteUrl "D.C." and Instagram pasted into stravaUrl.
 */

function extractFirstHttpUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const match = raw.match(/https?:\/\/[^\s,]+/i);
  if (!match) return null;
  try {
    return new URL(match[0]).toString();
  } catch {
    return null;
  }
}

/** True if the string looks like a valid HTTP(S) URL (has a host with a dot). */
function isValidHttpUrl(s?: string | null): boolean {
  if (!s || !s.trim()) return false;
  const u = s.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  try {
    const url = new URL(u);
    return !!(url.hostname && url.hostname.includes("."));
  } catch {
    return false;
  }
}

/**
 * Prefer a valid website URL. When acq_run_clubs has websiteUrl "D.C." (city) and url has the real site,
 * we want the real URL. Use url as fallback when websiteUrl is not a valid HTTP URL.
 */
export function normalizeWebsiteUrl(
  websiteUrl?: string | null,
  url?: string | null
): string | null {
  const a = websiteUrl?.trim() || null;
  const b = url?.trim() || null;
  if (isValidHttpUrl(a)) return new URL(a!).toString();
  if (isValidHttpUrl(b)) return new URL(b!).toString();
  const fromA = extractFirstHttpUrl(a);
  const fromB = extractFirstHttpUrl(b);
  return fromA || fromB || null;
}

/**
 * Strava URL only. If the only URL in the raw value is Instagram, return null
 * (don't persist Instagram into stravaUrl).
 */
export function normalizeStravaUrl(
  stravaUrl?: string | null,
  stravaClubUrl?: string | null
): string | null {
  const raw = stravaUrl?.trim() || stravaClubUrl?.trim() || null;
  if (!raw) return null;
  const extracted = extractFirstHttpUrl(raw);
  if (!extracted) return null;
  try {
    const host = new URL(extracted).hostname.toLowerCase();
    if (host.includes("instagram.com")) return null;
    return extracted;
  } catch {
    return null;
  }
}
