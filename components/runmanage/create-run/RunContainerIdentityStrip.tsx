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

  if (identity.kind === "store") {
    const place = [identity.city, identity.state].filter(Boolean).join(", ");
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        {identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded bg-white text-sm font-bold text-gray-700">
            {identity.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Store container</p>
          <p className="truncate text-sm font-semibold text-gray-900">{identity.name}</p>
          {place ? <p className="text-xs text-gray-600">{place}</p> : null}
        </div>
      </div>
    );
  }

  if (identity.kind === "race") {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">Race container</p>
        <p className="text-sm font-semibold text-gray-900">{identity.label}</p>
        <p className="mt-1 font-mono text-xs text-gray-600">Registry: {identity.registryId}</p>
      </div>
    );
  }

  if (identity.kind === "brand_popup") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50/60 px-4 py-3">
        {identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={identity.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded bg-white text-sm font-bold text-orange-800">
            {identity.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-800">Pop-up container</p>
          <p className="truncate text-sm font-semibold text-gray-900">{identity.name}</p>
          <p className="text-xs text-gray-600">{truncate(identity.tagline)}</p>
        </div>
      </div>
    );
  }

  if (identity.kind === "floating_event") {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Run event</p>
        <p className="text-sm font-semibold text-gray-900">{identity.title}</p>
        <p className="mt-1 text-xs text-gray-600">Floating special — RSVP lives on this run.</p>
      </div>
    );
  }

  return null;
}
