'use client';

import { Users } from 'lucide-react';
import type { CityRunRsvp } from '@/components/runs/city-run-types';

function Avatar({
  athlete,
  sizeClass = 'w-8 h-8',
}: {
  athlete?: { firstName: string; lastName: string; photoURL?: string | null } | null;
  sizeClass?: string;
}) {
  if (!athlete) return null;
  if (athlete.photoURL) {
    return (
      <img
        src={athlete.photoURL}
        alt={athlete.firstName}
        className={`${sizeClass} rounded-full object-cover border-2 border-white shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold border-2 border-white shrink-0 text-xs`}
    >
      {(athlete.firstName?.[0] || '?').toUpperCase()}
    </div>
  );
}

type CityRunPeopleSectionProps = {
  rsvps: CityRunRsvp[];
  locked?: boolean;
  expanded?: boolean;
  sticky?: boolean;
};

export default function CityRunPeopleSection({
  rsvps,
  locked = false,
  expanded = false,
  sticky = false,
}: CityRunPeopleSectionProps) {
  const going = rsvps.filter((r) => r.status === 'going');

  if (locked) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Who&apos;s going</h2>
          <p className="text-sm text-gray-500 mt-1">
            {going.length > 0
              ? `${going.length} ${going.length === 1 ? 'person' : 'people'} going · RSVP to see who`
              : 'No RSVPs yet — be the first to join'}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm px-6 py-8 text-center text-sm text-gray-500 border border-dashed border-gray-200">
          RSVP to unlock the full crew list and run chat.
        </div>
      </section>
    );
  }

  return (
    <section
      className={`bg-white rounded-xl shadow-sm p-6 ${sticky ? 'lg:sticky lg:top-4' : ''}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-gray-400" />
        <h2 className="font-semibold text-gray-900">Going ({going.length})</h2>
      </div>
      {going.length === 0 ? (
        <p className="text-sm text-gray-400">
          {expanded ? 'No one yet — be the first!' : "No one yet — you're the first!"}
        </p>
      ) : expanded ? (
        <div className="space-y-3">
          {going.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
              <Avatar athlete={r.Athlete} />
              <span className="text-sm text-gray-700">
                {r.Athlete?.firstName} {r.Athlete?.lastName}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {going.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <Avatar athlete={r.Athlete} />
              <span className="text-sm text-gray-700">
                {r.Athlete?.firstName} {r.Athlete?.lastName}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function CityRunGoingSummary({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm px-6 py-4 text-sm text-gray-600">
      <span className="font-semibold text-gray-900">
        {count} {count === 1 ? 'person' : 'people'} going
      </span>{' '}
      · RSVP to see who
    </div>
  );
}
