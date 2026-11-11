"use client";

export type RunClubMetaOnRun = {
  name?: string | null;
  runUrl?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  stravaUrl?: string | null;
};

function hrefOrNull(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return null;
}

function instagramHref(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (t.startsWith("http")) return t;
  const handle = t.replace(/^@/, "");
  return handle ? `https://instagram.com/${handle}` : null;
}

function MetaLine({
  label,
  href,
  display,
}: {
  label: string;
  href: string | null;
  display: string | null;
}) {
  if (!href || !display) {
    return (
      <p className="text-xs text-gray-500">
        <span className="font-medium text-gray-700">{label}:</span> not on club
      </p>
    );
  }
  return (
    <p className="text-xs text-gray-700">
      <span className="font-medium text-gray-900">{label}:</span>{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sky-700 underline hover:text-sky-900"
      >
        {display}
      </a>
    </p>
  );
}

export default function RunManageClubMetaOnRun({ club }: { club: RunClubMetaOnRun | null | undefined }) {
  if (!club?.name?.trim()) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <p className="text-xs text-gray-600">No club on this run.</p>
      </div>
    );
  }

  const runPage = hrefOrNull(club.runUrl);
  const website = hrefOrNull(club.websiteUrl);
  const instagram = instagramHref(club.instagramUrl);
  const strava = hrefOrNull(club.stravaUrl);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs font-semibold text-gray-900">{club.name}</p>
      <div className="mt-1.5 space-y-0.5">
        <MetaLine label="Runs page" href={runPage} display={club.runUrl?.trim() ?? null} />
        <MetaLine label="Website" href={website} display={club.websiteUrl?.trim() ?? null} />
        <MetaLine label="Instagram" href={instagram} display={club.instagramUrl?.trim() ?? null} />
        <MetaLine label="Strava club" href={strava} display={club.stravaUrl?.trim() ?? null} />
      </div>
    </div>
  );
}
