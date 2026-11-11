"use client";

import { ExternalLink } from "lucide-react";
import { blocksPublicRunCreation } from "@/lib/clubRunAccess";
import type { RunClubPublicSources } from "@/components/runmanage/runInstanceWizard/RunClubPublicSourcesCard";

function externalHttpUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t?.startsWith("http")) return null;
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
  if (!t?.startsWith("http")) return null;
  return t.startsWith("https") ? t : null;
}

function LinkChip({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        primary
          ? "inline-flex items-center gap-1 rounded-full bg-orange-600 px-3 py-1 text-xs font-medium text-white hover:bg-orange-700"
          : "inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50"
      }
    >
      {label}
      <ExternalLink className="h-3 w-3 opacity-70" />
    </a>
  );
}

export default function RunManageClubSourceLinks({
  runClub,
}: {
  runClub: RunClubPublicSources | null | undefined;
}) {
  if (!runClub) return null;

  const runsPageUrl = externalHttpUrl(runClub.runUrl);
  const websiteUrl = externalHttpUrl(runClub.websiteUrl);
  const instagramUrl = instagramPublicUrl(runClub.instagramHandle);
  const stravaClubUrl = stravaPublicUrl(runClub.stravaUrl);
  const runAccessBlocked = blocksPublicRunCreation(runClub);

  const hasLinks = Boolean(runsPageUrl || websiteUrl || instagramUrl || stravaClubUrl);
  if (!hasLinks && !runAccessBlocked) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {runAccessBlocked ? (
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-900 ring-1 ring-inset ring-red-200">
          Member-only club — public runs blocked
        </span>
      ) : null}
      {runsPageUrl ? <LinkChip href={runsPageUrl} label="Club runs page" primary /> : null}
      {websiteUrl ? <LinkChip href={websiteUrl} label="Club website" /> : null}
      {instagramUrl ? <LinkChip href={instagramUrl} label="Instagram" /> : null}
      {stravaClubUrl ? <LinkChip href={stravaClubUrl} label="Strava club" /> : null}
    </div>
  );
}
