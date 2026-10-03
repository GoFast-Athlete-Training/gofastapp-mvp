"use client";

import type { RunContainerIdentity } from "@/lib/runmanage/create-run-scope";

function truncate(s: string, max = 160): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export default function RunContainerIdentityStrip({
  identity,
}: {
  identity: RunContainerIdentity | null;
}) {
  if (!identity || identity.kind === "none") return null;

  if (identity.kind === "club") {
    const place = [identity.city, identity.state].filter(Boolean).join(", ");
    return (
      <div className="flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3">
        {identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded bg-white text-sm font-bold text-sky-800">
            {identity.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Club container</p>
          <p className="truncate text-sm font-semibold text-gray-900">{identity.name}</p>
          {place ? <p className="text-xs text-gray-600">{place}</p> : null}
          {identity.tagline ? (
            <p className="mt-1 text-xs text-gray-600">{truncate(identity.tagline)}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (identity.kind === "special_event") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50/60 px-4 py-3">
        {identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded bg-white text-sm font-bold text-orange-800">
            {identity.leadName.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-800">
            Special event parent
          </p>
          <p className="truncate text-sm font-semibold text-gray-900">{identity.eventName}</p>
          {identity.eventTitle ? (
            <p className="text-xs text-gray-600">{identity.eventTitle}</p>
          ) : null}
          <p className="text-xs text-gray-600">Lead: {identity.leadName}</p>
          {identity.eventDate ? (
            <p className="text-xs text-gray-500">Event date: {identity.eventDate}</p>
          ) : null}
          {identity.url ? (
            <p className="truncate text-xs text-sky-700">{identity.url}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
