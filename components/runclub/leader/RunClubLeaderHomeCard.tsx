'use client';

import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import type { LeaderContext } from '@/lib/run-club-leader-context';

interface RunClubLeaderHomeCardProps {
  leaderContext: LeaderContext;
}

export default function RunClubLeaderHomeCard({ leaderContext }: RunClubLeaderHomeCardProps) {
  const { clubs } = leaderContext;
  const clubCount = clubs.length;

  let href = '/leader';
  let title = 'Manage your run clubs';
  let description = 'Open the run club manager to update your club profile and weekly runs.';
  let cta = 'Open manager';

  if (clubCount === 0) {
    title = 'Your leader account is ready';
    description =
      'GoFast still needs to connect your club. Ask staff to link your owner or admin membership.';
    cta = 'Learn more';
    href = '/leader';
  } else if (clubCount === 1) {
    const club = clubs[0];
    title = `Manage ${club.runClubName}`;
    description = 'Fix your club meta, set weekly runs, and keep members in the loop.';
    cta = 'Open manager';
    href = `/leader/runclub/${club.runClubSlug ?? club.runClubId}`;
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4 min-w-0">
          {clubCount === 1 && clubs[0].logoUrl ? (
            <img
              src={clubs[0].logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl border border-sky-100 bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <Building2 className="h-7 w-7" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-800">
              Run club manager
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
            {clubCount > 1 ? (
              <p className="mt-2 text-xs font-medium text-sky-800">
                {clubCount} clubs ready to manage
              </p>
            ) : null}
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 self-start"
        >
          {cta}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
