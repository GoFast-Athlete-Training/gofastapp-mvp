/**
 * Canonical public run **read** URL on gofast-contentpublic (dcruns / Pulse parity).
 * Share links and link-tree CITY_RUN buttons use this — not gofastlinks /run/{slug}.
 *
 * Join / RSVP stays on pr: getGoFastAppPublicUrl() + /join/run/{slug}.
 */
import { generateCityRunUrlPath } from "@/lib/slug-utils";

type PublicRunDetailSegment =
  | "clubrun"
  | "shakeout"
  | "cityrun"
  | "runcrew"
  | "runstore"
  | "specialrun";

const SEGMENT_BY_TYPE: Record<string, PublicRunDetailSegment> = {
  CLUB: "clubrun",
  RACE_SHAKEOUT: "shakeout",
  INDIVIDUAL: "cityrun",
  RUN_CREW: "runcrew",
  RUN_STORE: "runstore",
  SPECIAL: "specialrun",
  OTHER: "cityrun",
};

export function publicRunDetailSegment(
  cityRunType: string | null | undefined,
): PublicRunDetailSegment {
  const key = cityRunType?.trim().toUpperCase();
  if (key && key in SEGMENT_BY_TYPE) {
    return SEGMENT_BY_TYPE[key]!;
  }
  return "cityrun";
}

export function publicRunDetailPath(
  cityRunType: string | null | undefined,
  slugOrId: string,
): string {
  const key = slugOrId.trim();
  const segment = publicRunDetailSegment(cityRunType);
  return `/${segment}/${encodeURIComponent(key)}`;
}

const DEFAULT_PUBLIC_RUN_SITE = "https://dcruns.gofastcrushgoals.com";

/** Bio / link-tree hosts — never use for public run detail share URLs. */
function isLinkTreeOnlyHost(baseUrl: string): boolean {
  const host = baseUrl.replace(/^https?:\/\//i, "").split("/")[0]?.toLowerCase() ?? "";
  return host.includes("gofastlinks") || host.includes("athletelinks");
}

function pickPublicRunSiteBase(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_PUBLIC_RUN_SITE_URL,
    process.env.NEXT_PUBLIC_DC_RUNS_URL,
    process.env.PUBLIC_RUN_SITE_URL,
  ];
  for (const raw of candidates) {
    const base = raw?.trim().replace(/\/$/, "");
    if (base && !isLinkTreeOnlyHost(base)) return base;
  }
  return DEFAULT_PUBLIC_RUN_SITE;
}

/** Directory / Pulse host where typed run detail pages live. */
export function getPublicRunSiteBaseUrl(): string {
  return pickPublicRunSiteBase();
}

/** Reject legacy gofastlinks /run/{slug} slices masquerading as share URLs. */
export function normalizeInviteShareUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/\/run\/[^/?#]+/i.test(trimmed) && isLinkTreeOnlyHost(trimmed)) {
    return null;
  }
  return trimmed;
}

export function getPublicRunDetailPageUrl(
  run: {
    id: string;
    slug?: string | null;
    cityRunType?: string | null;
    runClub?: { slug: string } | null;
  },
): string {
  const base = getPublicRunSiteBaseUrl();
  const slug = run.slug?.trim();
  if (slug && run.runClub?.slug?.trim()) {
    return `${base}${generateCityRunUrlPath({
      id: run.id,
      slug,
      runClub: { slug: run.runClub.slug.trim() },
    })}`;
  }
  if (slug) {
    return `${base}${publicRunDetailPath(run.cityRunType, slug)}`;
  }
  return `${base}/runs/${encodeURIComponent(run.id)}`;
}
