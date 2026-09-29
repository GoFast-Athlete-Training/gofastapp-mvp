"use client";

import { ExternalLink } from "lucide-react";
import { blocksPublicRunCreation } from "@/lib/clubRunAccess";

export type RunClubPublicSources = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  runUrl?: string | null;
  stravaUrl?: string | null;
  instagramHandle?: string | null;
  allRunsDescription?: string | null;
  runsRequireMembership?: boolean | null;
  runAccessNotes?: string | null;
  membershipType?: string | null;
};

function externalHttpUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t.startsWith("http") ? t : `https://${t}`;
}

function instagramPublicUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t.startsWith("http")) return t;
  const handle = t
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, "")
    .replace(/\/$/, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

function stravaPublicUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t.startsWith("http")) return t;
  if (t.includes(".")) return `https://${t}`;
  return null;
}

function truncateSnippet(text: string, max = 220): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function PublicSourceLink({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        primary
          ? "inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
          : "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
      }
    >
      {label}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-80" />
    </a>
  );
}

/** Map acq_run_clubs API row into the public-sources card shape. */
export function acqRunClubToPublicSources(
  raw: Record<string, unknown>
): RunClubPublicSources {
  const instagram =
    typeof raw.instagramHandle === "string"
      ? raw.instagramHandle
      : typeof raw.instagramUrl === "string"
        ? raw.instagramUrl
        : null;

  return {
    id: raw.id != null ? String(raw.id) : null,
    name: typeof raw.name === "string" ? raw.name : null,
    slug: typeof raw.slug === "string" ? raw.slug : null,
    city: typeof raw.city === "string" ? raw.city : null,
    websiteUrl:
      typeof raw.websiteUrl === "string"
        ? raw.websiteUrl
        : typeof raw.url === "string"
          ? raw.url
          : null,
    runUrl: typeof raw.runUrl === "string" ? raw.runUrl : null,
    stravaUrl:
      typeof raw.stravaUrl === "string"
        ? raw.stravaUrl
        : typeof raw.stravaClubUrl === "string"
          ? raw.stravaClubUrl
          : null,
    instagramHandle: instagram,
    allRunsDescription:
      typeof raw.allRunsDescription === "string" ? raw.allRunsDescription : null,
    runsRequireMembership: raw.runsRequireMembership === true,
    runAccessNotes: typeof raw.runAccessNotes === "string" ? raw.runAccessNotes : null,
    membershipType: typeof raw.membershipType === "string" ? raw.membershipType : null,
  };
}

/** General club links and overview — reference only, not run-specific sources. */
export default function RunClubPublicSourcesCard({
  runClub,
}: {
  runClub: RunClubPublicSources | null | undefined;
}) {
  const stravaClubUrl = stravaPublicUrl(runClub?.stravaUrl);
  const runsPageUrl = externalHttpUrl(runClub?.runUrl);
  const instagramUrl = instagramPublicUrl(runClub?.instagramHandle);
  const websiteUrl = externalHttpUrl(runClub?.websiteUrl);
  const overview = runClub?.allRunsDescription?.trim() || "";
  const runAccessBlocked = runClub ? blocksPublicRunCreation(runClub) : false;
  const runAccessNotes = runClub?.runAccessNotes?.trim() || "";

  const hasLinks = Boolean(stravaClubUrl || runsPageUrl || instagramUrl || websiteUrl);
  const hasContext = Boolean(runClub?.name?.trim() || overview || runAccessBlocked);

  if (!hasLinks && !hasContext) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 shadow-sm">
      {runAccessBlocked ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <p className="font-semibold">Public run creation blocked</p>
          <p className="mt-1 text-xs leading-relaxed">
            This club&apos;s run schedule is member-only. Public run instances cannot be seeded from
            this source.
          </p>
          {runAccessNotes ? (
            <p className="mt-2 text-xs text-red-800">
              <span className="font-medium">Staff note:</span> {runAccessNotes}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        General club reference
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Club-wide links if you need them while reviewing this run. Run-specific source URLs belong
        on the Description step below.
      </p>

      {hasLinks ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {stravaClubUrl ? (
            <PublicSourceLink href={stravaClubUrl} label="Strava club" primary />
          ) : null}
          {runsPageUrl ? (
            <PublicSourceLink href={runsPageUrl} label="All-runs page" />
          ) : null}
          {instagramUrl ? <PublicSourceLink href={instagramUrl} label="Instagram" /> : null}
          {websiteUrl ? <PublicSourceLink href={websiteUrl} label="Club website" /> : null}
        </div>
      ) : null}

      {overview ? (
        <p className="mt-2 text-xs leading-relaxed text-gray-600">{truncateSnippet(overview)}</p>
      ) : null}
    </div>
  );
}
