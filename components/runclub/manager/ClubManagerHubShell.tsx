'use client';

import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import { clubManagerClubPath } from '@/lib/club-manager-paths';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';

interface ClubManagerHubShellProps {
  children: React.ReactNode;
  clubs: LeaderContextClub[];
}

export default function ClubManagerHubShell({ children, clubs }: ClubManagerHubShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
        <aside className="w-full bg-white border-b-2 border-gray-200 flex flex-col shrink-0 md:w-64 md:border-b-0 md:border-r-2 md:overflow-y-auto">
          <div className="px-4 pt-4 pb-2 md:p-4 md:border-b md:border-gray-200">
            <p className="text-lg font-bold text-gray-900">Club Manager</p>
            <p className="text-xs text-gray-500 mt-1">Your clubs</p>
          </div>

          <nav className="p-2 md:flex-1 md:space-y-1" aria-label="Club Manager">
            <Link
              href="/athlete-home"
              className="mb-2 flex w-max items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 md:w-full"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to athlete
            </Link>

            <p className="hidden px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 md:block">
              Clubs
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
              {clubs.map((club) => (
                <Link
                  key={club.runClubId}
                  href={clubManagerClubPath(club.runClubSlug ?? club.runClubId)}
                  className="flex min-w-max items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-transparent md:w-full"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
                  <span className="truncate">{club.runClubName}</span>
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
