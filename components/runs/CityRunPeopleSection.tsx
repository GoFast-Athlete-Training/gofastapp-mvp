'use client';

import { Users } from 'lucide-react';
import type { CityRunRsvp } from '@/components/runs/city-run-types';
import { splitCityRunRsvpsByRole } from '@/lib/city-run/rsvp-attendance';

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

function PersonRow({ rsvp }: { rsvp: CityRunRsvp }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
      <Avatar athlete={rsvp.Athlete} />
      <span className="text-sm text-gray-700">
        {rsvp.Athlete?.firstName} {rsvp.Athlete?.lastName}
      </span>
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
  const { host, members } = splitCityRunRsvpsByRole(rsvps);
  const attendingCount = (host ? 1 : 0) + members.length;

  if (locked) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Who&apos;s on this run</h2>
          <p className="text-sm text-gray-500 mt-1">
            {attendingCount > 0
              ? `${attendingCount} ${attendingCount === 1 ? 'person' : 'people'} · RSVP to see who`
              : 'No one yet — be the first to join'}
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
      className={`bg-white rounded-xl shadow-sm p-6 space-y-4 ${sticky ? 'lg:sticky lg:top-4' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-gray-400" />
        <h2 className="font-semibold text-gray-900">On this run</h2>
      </div>

      {host ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 mb-2">Host</p>
          {expanded ? (
            <PersonRow rsvp={host} />
          ) : (
            <div className="flex items-center gap-2">
              <Avatar athlete={host.Athlete} />
              <span className="text-sm text-gray-700">
                {host.Athlete?.firstName} {host.Athlete?.lastName}
              </span>
            </div>
          )}
        </div>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Members{members.length ? ` (${members.length})` : ''}
        </p>
        {members.length === 0 ? (
          <p className="text-sm text-gray-400">
            {expanded ? 'No members yet.' : host ? 'No members yet.' : 'No one yet — be the first!'}
          </p>
        ) : expanded ? (
          <div className="space-y-3">
            {members.map((r) => (
              <PersonRow key={r.id} rsvp={r} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {members.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <Avatar athlete={r.Athlete} />
                <span className="text-sm text-gray-700">
                  {r.Athlete?.firstName} {r.Athlete?.lastName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function CityRunGoingSummary({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="bg-white rounded-xl shadow-sm px-6 py-4 text-sm text-gray-600">
      <span className="font-semibold text-gray-900">
        {count} {count === 1 ? 'person' : 'people'} on this run
      </span>{' '}
      · RSVP to see who
    </div>
  );
}

function PublicPersonRow({ rsvp }: { rsvp: CityRunRsvp }) {
  const handle = rsvp.Athlete?.gofastHandle?.trim();
  const label = handle ? `@${handle.replace(/^@/, '')}` : 'Runner';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
      <Avatar athlete={rsvp.Athlete} />
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </div>
  );
}

/** Public RSVP page — face + gofastHandle, no RSVP lock. */
export function PublicSeeWhosGoingSection({ rsvps }: { rsvps: CityRunRsvp[] }) {
  const { host, members } = splitCityRunRsvpsByRole(rsvps);
  const attending = [host, ...members].filter(Boolean) as CityRunRsvp[];

  return (
    <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900">See Who&apos;s Going</h2>
        {attending.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">Be the first one to commit.</p>
        ) : null}
      </div>
      {attending.length > 0 ? (
        <div className="space-y-2">
          {attending.map((r) => (
            <PublicPersonRow key={r.id} rsvp={r} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
