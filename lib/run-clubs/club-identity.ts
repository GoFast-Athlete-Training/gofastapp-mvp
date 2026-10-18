import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const NAME_SUFFIXES =
  /\b(inc\.?|llc\.?|l\.?l\.?c\.?|corp\.?|corporation|company|co\.?|running|run club|run clubs|running club)\b/gi;

export function normalizeClubIdentityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(NAME_SUFFIXES, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeReferenceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).replace(/^@/, "").toLowerCase();
    return handle ? `instagram:@${handle}` : "";
  }
  try {
    const withProto = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export type ProdParsedReference = {
  websiteUrl: string | null;
  instagramUrl: string | null;
  stravaUrl: string | null;
  runUrl: string | null;
};

export function parseClubReferenceForProd(raw: string): ProdParsedReference {
  const trimmed = raw.trim();
  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).replace(/^@/, "").trim();
    return {
      websiteUrl: null,
      instagramUrl: handle ? `https://instagram.com/${handle}` : null,
      stravaUrl: null,
      runUrl: null,
    };
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return { websiteUrl: null, instagramUrl: url, stravaUrl: null, runUrl: null };
  }
  if (lower.includes("strava.com")) {
    return {
      websiteUrl: null,
      instagramUrl: null,
      stravaUrl: trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
      runUrl: null,
    };
  }
  const websiteUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  return { websiteUrl, instagramUrl: null, stravaUrl: null, runUrl: null };
}

export function generateClubSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ProdClubIdentityMatch = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  matchReason: "reference" | "name_city";
};

const identitySelect = {
  id: true,
  name: true,
  city: true,
  slug: true,
  websiteUrl: true,
  runUrl: true,
  stravaUrl: true,
  instagramUrl: true,
} as const;

function referenceMatchesProdRow(
  normalizedRef: string,
  row: {
    websiteUrl: string | null;
    runUrl: string | null;
    stravaUrl: string | null;
    instagramUrl: string | null;
  },
): boolean {
  const candidates: string[] = [];
  if (row.websiteUrl?.trim()) candidates.push(normalizeReferenceUrl(row.websiteUrl));
  if (row.runUrl?.trim()) candidates.push(normalizeReferenceUrl(row.runUrl));
  if (row.stravaUrl?.trim()) candidates.push(normalizeReferenceUrl(row.stravaUrl));
  if (row.instagramUrl?.trim()) candidates.push(normalizeReferenceUrl(row.instagramUrl));
  return candidates.some((c) => c && c === normalizedRef);
}

export async function findProdClubIdentityMatch(
  input: { name: string; city: string; reference: string },
  db: PrismaClient = prisma,
): Promise<ProdClubIdentityMatch | null> {
  const normalizedRef = normalizeReferenceUrl(input.reference);
  const normalizedName = normalizeClubIdentityName(input.name);
  const normalizedCity = input.city.trim().toLowerCase();

  if (normalizedRef) {
    const refCandidates = await db.run_clubs.findMany({
      select: identitySelect,
      take: 500,
      orderBy: { name: "asc" },
    });
    for (const row of refCandidates) {
      if (referenceMatchesProdRow(normalizedRef, row)) {
        return {
          id: row.id,
          name: row.name,
          city: row.city,
          slug: row.slug,
          matchReason: "reference",
        };
      }
    }
  }

  if (!normalizedName || !normalizedCity) return null;

  const nameCandidates = await db.run_clubs.findMany({
    where: { city: { equals: input.city.trim(), mode: "insensitive" } },
    select: identitySelect,
    take: 200,
  });

  for (const row of nameCandidates) {
    if (normalizeClubIdentityName(row.name) === normalizedName) {
      return {
        id: row.id,
        name: row.name,
        city: row.city,
        slug: row.slug,
        matchReason: "name_city",
      };
    }
  }

  return null;
}

export async function ensureUniqueProdClubSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug || "club";
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await prisma.run_clubs.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) return candidate;
    suffix += 1;
    if (suffix > 20) {
      return `${slug}-${randomUUID().slice(0, 8)}`;
    }
  }
}

/** Fill empty identity fields only — preserve description and other rich data. */
export function mergeProdClubIdentityFields(
  existing: {
    name: string;
    city: string | null;
    websiteUrl: string | null;
    instagramUrl: string | null;
    stravaUrl: string | null;
    runUrl: string | null;
  },
  incoming: {
    name: string;
    city: string;
    websiteUrl: string | null;
    instagramUrl: string | null;
    stravaUrl: string | null;
    runUrl: string | null;
  },
): {
  name: string;
  city: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  stravaUrl: string | null;
  runUrl: string | null;
} {
  return {
    name: existing.name?.trim() ? existing.name : incoming.name,
    city: existing.city?.trim() ? existing.city : incoming.city,
    websiteUrl: existing.websiteUrl?.trim() ? existing.websiteUrl : incoming.websiteUrl,
    instagramUrl: existing.instagramUrl?.trim() ? existing.instagramUrl : incoming.instagramUrl,
    stravaUrl: existing.stravaUrl?.trim() ? existing.stravaUrl : incoming.stravaUrl,
    runUrl: existing.runUrl?.trim() ? existing.runUrl : incoming.runUrl,
  };
}
