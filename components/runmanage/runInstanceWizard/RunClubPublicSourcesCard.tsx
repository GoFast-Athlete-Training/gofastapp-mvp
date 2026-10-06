"use client";

import { ExternalLink } from "lucide-react";
import { blocksPublicRunCreation } from "@/lib/clubRunAccess";
import { getPublicRunContentUrl } from "@/lib/publicRunUrl";

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

export type RunInstancePublicReadout = {
  cityRunId?: string | null;
  slug?: string | null;
  citySlug?: string | null;
  description?: string | null;
  seriesPhotoUrl?: string | null;
  groupPhotoUrl?: string | null;
};

function externalHttpUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (!t.startsWith("http")) return null;
  return t;
}

function instagramPublicUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t.startsWith("http")) return t.startsWith("https") ? t : null;
  const handle = t
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, "")
    .replace(/\/$/, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

function stravaPublicUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t.startsWith("http")) return t.startsWith("https") ? t : null;
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
  raw: Record<string, unknown>,
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

/** Club lookup links + this instance's public readout. */
export default function RunClubPublicSourcesCard({
  runClub,
  instance,
}: {
  runClub: RunClubPublicSources | null | undefined;
  instance?: RunInstancePublicReadout | null;
}) {
  const stravaClubUrl = stravaPublicUrl(runClub?.stravaUrl);
  const runsPageUrl = externalHttpUrl(runClub?.runUrl);
  const instagramUrl = instagramPublicUrl(runClub?.instagramHandle);
  const websiteUrl = externalHttpUrl(runClub?.websiteUrl);
  const overview = runClub?.allRunsDescription?.trim() || "";
  const runAccessBlocked = runClub ? blocksPublicRunCreation(runClub) : false;
  const runAccessNotes = runClub?.runAccessNotes?.trim() || "";

  const hasClubLinks = Boolean(runsPageUrl || instagramUrl || websiteUrl || stravaClubUrl);
  const hasClubContext = Boolean(runClub?.name?.trim() || overview || runAccessBlocked);

  const publicRunUrl =
    instance?.cityRunId?.trim()
      ? getPublicRunContentUrl({
          runId: instance.cityRunId.trim(),
          slug: instance.slug,
          citySlug: instance.citySlug,
        })
      : null;

  const descriptionSnippet = instance?.description?.trim()
    ? truncateSnippet(instance.description, 280)
    : null;

  const highlightPhotoUrl =
    instance?.seriesPhotoUrl?.trim() ||
    instance?.groupPhotoUrl?.trim() ||
    null;
  const highlightLabel = instance?.seriesPhotoUrl?.trim()
    ? "Series workout photo"
    : instance?.groupPhotoUrl?.trim()
      ? "Club group photo"
      : null;

  const hasInstance = Boolean(publicRunUrl || descriptionSnippet || highlightPhotoUrl);

  if (!hasClubLinks && !hasClubContext && !hasInstance) return null;

  return (
    <div className="space-y-3">
      {(hasClubLinks || hasClubContext) && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3 shadow-sm">
          {runAccessBlocked ? (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <p className="font-semibold">Public run creation blocked</p>
              <p className="mt-1 text-xs leading-relaxed">
                This club&apos;s run schedule is member-only. Public run instances cannot be seeded
                from this source.
              </p>
              {runAccessNotes ? (
                <p className="mt-2 text-xs text-red-800">
                  <span className="font-medium">Staff note:</span> {runAccessNotes}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Club lookup</p>
          <p className="mt-1 text-sm text-gray-600">
            Open the club&apos;s runs page (and site or Instagram when listed) to see whether they
            posted this workout. Then update meet-up, route or workout, and public description on
            this instance.
          </p>

          {hasClubLinks ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {runsPageUrl ? (
                <PublicSourceLink href={runsPageUrl} label="Club runs page" primary />
              ) : null}
              {websiteUrl ? <PublicSourceLink href={websiteUrl} label="Club website" /> : null}
              {instagramUrl ? <PublicSourceLink href={instagramUrl} label="Instagram" /> : null}
              {stravaClubUrl ? (
                <PublicSourceLink href={stravaClubUrl} label="Strava club" />
              ) : null}
            </div>
          ) : null}

          {overview ? (
            <p className="mt-2 text-xs leading-relaxed text-gray-600">{truncateSnippet(overview)}</p>
          ) : null}
        </div>
      )}

      {hasInstance ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            This instance (GoFast public)
          </p>
          <p className="mt-1 text-sm text-sky-900/80">
            What runners see after you save — description and highlight photo on the public run page.
          </p>

          {publicRunUrl ? (
            <div className="mt-3">
              <PublicSourceLink href={publicRunUrl} label="Public run" primary />
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-medium text-gray-600">Public description</p>
              <p className="mt-1 text-sm text-gray-800">
                {descriptionSnippet ?? (
                  <span className="text-gray-500">No public description yet.</span>
                )}
              </p>
            </div>
            <div className="sm:max-w-[140px]">
              <p className="text-xs font-medium text-gray-600">Photo</p>
              {highlightPhotoUrl ? (
                <div className="mt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={highlightPhotoUrl}
                    alt={highlightLabel ?? "Run highlight"}
                    className="h-24 w-full rounded-md border border-gray-200 object-cover"
                  />
                  {highlightLabel ? (
                    <p className="mt-1 text-[10px] text-gray-500">{highlightLabel}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-500">No photo.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
