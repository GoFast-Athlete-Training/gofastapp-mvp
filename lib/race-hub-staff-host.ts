/** Dedicated staff read-only race hub host (`racehubstaff.gofastcrushgoals.com`). */

export const RACE_HUB_STAFF_HOST_PREFIX = "racehubstaff.";

export function isRaceHubStaffHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(":")[0]?.trim() ?? "";
  return h.startsWith(RACE_HUB_STAFF_HOST_PREFIX);
}

export function getRaceHubStaffOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_RACE_HUB_STAFF_URL?.replace(/\/$/, "") ||
    "https://racehubstaff.gofastcrushgoals.com"
  );
}

export function raceHubStaffPath(slug: string): string {
  return `/race-hub/${encodeURIComponent(slug.trim())}`;
}

export function raceHubStaffUrl(slug: string): string {
  return `${getRaceHubStaffOrigin()}${raceHubStaffPath(slug)}`;
}

export function hostFromRequest(request: Request): string {
  const raw =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    "";
  return raw.split(":")[0]?.trim() ?? "";
}

export function isRaceHubStaffHostRequest(request: Request): boolean {
  return isRaceHubStaffHostname(hostFromRequest(request));
}
