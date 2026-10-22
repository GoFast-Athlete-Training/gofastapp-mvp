'use client';

import type { CityRunDetails } from '@/components/runs/city-run-types';
import { splitCityRunRsvpsByRole } from '@/lib/city-run/rsvp-attendance';

type Props = {
  run: CityRunDetails;
};

function displayName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ').trim() || 'Host';
}

export default function CityRunHostedByStrip({ run }: Props) {
  const { host } = splitCityRunRsvpsByRole(run.rsvps || []);
  const hostAthlete = host?.Athlete;
  const club = run.runClub;

  const name =
    club?.name ||
    (hostAthlete ? displayName(hostAthlete.firstName, hostAthlete.lastName) : null) ||
    'Your host';
  const photo =
    club?.logoUrl ||
    hostAthlete?.photoURL ||
    run.hostPhotoUrl ||
    null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
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
    </div>
  );
}
