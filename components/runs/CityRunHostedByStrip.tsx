'use client';

import type { ReactNode } from 'react';
import type { CityRunDetails } from '@/components/runs/city-run-types';
import { splitCityRunRsvpsByRole } from '@/lib/city-run/rsvp-attendance';
import { resolveShakeoutPublicHost } from '@/lib/city-run/shakeout-public-host';
import { athleteProfileHref } from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  run: CityRunDetails;
};

function displayName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || 'Host';
}

function HostedByShell({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  const className = 'flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3';
  if (!href) {
    return <div className={className}>{children}</div>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:border-orange-200 hover:bg-orange-50/60`}
    >
      {children}
    </a>
  );
}

export default function CityRunHostedByStrip({ run }: Props) {
  const shakeoutHost = resolveShakeoutPublicHost(run);
  const isStaffShakeout = run.cityRunType === 'RACE_SHAKEOUT';

  if (isStaffShakeout) {
    if (!shakeoutHost) return null;
    const initial = shakeoutHost.name.charAt(0).toUpperCase();
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        {shakeoutHost.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shakeoutHost.logoUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover ring-2 ring-orange-100"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
            {initial}
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Hosted by
          </p>
          <p className="font-semibold text-gray-900">{shakeoutHost.name}</p>
        </div>
      </div>
    );
  }

  const { host } = splitCityRunRsvpsByRole(run.rsvps || []);
  const hostAthlete = host?.Athlete;
  const club = run.runClub;
  const brandHost = resolveShakeoutPublicHost(run);

  const name =
    club?.name ||
    brandHost?.name ||
    (hostAthlete ? displayName(hostAthlete.firstName, hostAthlete.lastName) : null);
  if (!name) return null;

  const photo =
    club?.logoUrl ||
    brandHost?.logoUrl ||
    hostAthlete?.photoURL ||
    run.hostPhotoUrl ||
    null;
  const personHostHref =
    club || brandHost ? null : athleteProfileHref(hostAthlete?.gofastHandle);

  return (
    <HostedByShell href={personHostHref}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          className="h-12 w-12 rounded-full object-cover ring-2 ring-orange-100"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-lg font-bold text-orange-700">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Hosted by
        </p>
        <p className="font-semibold text-gray-900">{name}</p>
        {club?.city ? (
          <p className="text-sm text-gray-600">{club.city}</p>
        ) : null}
      </div>
    </HostedByShell>
  );
}
