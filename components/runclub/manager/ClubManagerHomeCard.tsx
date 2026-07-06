'use client';

import Link from 'next/link';
import { Building2, ChevronRight } from 'lucide-react';
import type { LeaderContext } from '@/lib/run-club-leader-context';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

export type PendingClubLeaderClaim = {
  claimId: string;
  runClubId: string;
  runClubSlug: string | null;
  runClubName: string;
};

interface ClubManagerHomeCardProps {
  leaderContext?: LeaderContext | null;
  pendingClaims?: PendingClubLeaderClaim[];
}

export default function ClubManagerHomeCard({
  leaderContext,
  pendingClaims = [],
}: ClubManagerHomeCardProps) {
  const clubs = leaderContext?.clubs ?? [];
  const clubCount = clubs.length;
  const pendingCount = pendingClaims.length;

  let href = clubManagerHubPath();
  let title = 'Manage your run clubs';
  let description = 'Open Club Manager to update your club profile and weekly runs.';
  let cta = 'Open manager';

  if (clubCount === 0 && pendingCount === 1) {
    const pending = pendingClaims[0]!;
    title = `Activate ${pending.runClubName}`;
    description =
      'GoFast has manager access waiting for your email. Finish activation to open your club container.';
    cta = 'Activate';
    href = '/welcome-club-owner';
  } else if (clubCount === 0 && pendingCount > 1) {
    title = 'Activate your run clubs';
    description = `${pendingCount} clubs are ready for manager activation with this email.`;
    cta = 'Choose club';
    href = '/welcome-club-owner';
  } else if (clubCount === 0) {
    title = 'Club Manager is ready';
    description =
      'GoFast still needs to connect your club. Ask staff to send a manager activation link.';
    cta = 'Learn more';
    href = clubManagerHubPath();
  } else if (clubCount === 1) {
    const club = clubs[0];
    title = `Manage ${club.runClubName}`;
    description = 'Update club profile, runs, and announcements for your members.';
    cta = 'Open manager';
    href = clubManagerClubPath(club.runClubSlug ?? club.runClubId);
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4 min-w-0">
          {clubCount === 1 && clubs[0]?.logoUrl ? (
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-800">Club Manager</p>
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
