'use client';

import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import type { LeaderContext } from '@/lib/run-club-leader-context';
import { clubManagerActivatePath, clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';
import { LocalStorageAPI } from '@/lib/localstorage';

interface ClubManagerHomeCardProps {
  leaderContext?: LeaderContext | null;
}

/** Opt-in Club Manager entry from athlete-home (never auto-yank from athlete door). */
export default function ClubManagerHomeCard({ leaderContext }: ClubManagerHomeCardProps) {
  const clubs = leaderContext?.clubs ?? [];
  const clubCount = clubs.length;
  const activationToken = LocalStorageAPI.getClubManagerActivationToken();

  let href = clubManagerHubPath();
  let title = 'Club Manager';
  let description = 'Open Club Manager to update your club profile, runs, and announcements.';
  let cta = 'Open manager';

  if (clubCount === 1) {
    const club = clubs[0]!;
    title = `Manage ${club.runClubName}`;
    description = 'Update club profile, runs, and announcements for your members.';
    href = clubManagerClubPath(club.runClubSlug ?? club.runClubId);
  } else if (clubCount > 1) {
    title = 'Manage your run clubs';
    description = `${clubCount} clubs ready to manage.`;
  } else if (activationToken) {
    title = 'Finish manager invite';
    description = 'Complete your invite to link your GoFast account to club manager access.';
    cta = 'Complete invite';
    href = clubManagerActivatePath(activationToken);
  } else {
    description = 'Ask GoFast staff to send a manager invite link if you need access.';
    cta = 'Club Manager';
  }

  return (
    <div className="mb-4 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-4">
          {clubCount === 1 && clubs[0]?.logoUrl ? (
            <img
              src={clubs[0].logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl border border-orange-100 bg-white object-contain p-1"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <Building2 className="h-7 w-7" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-800">Club Manager</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          {cta}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** @deprecated Use ClubManagerHomeCard */
export function RunClubLeaderHomeCard(props: ClubManagerHomeCardProps) {
  return <ClubManagerHomeCard {...props} />;
}

export type PendingClubLeaderClaim = never;
