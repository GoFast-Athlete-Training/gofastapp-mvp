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
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r-2 border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <p className="text-lg font-bold text-gray-900">Club Manager</p>
            <p className="text-xs text-gray-500 mt-1">Your clubs</p>
          </div>

          <nav className="flex-1 p-2 space-y-1" aria-label="Club Manager">
            <Link
              href="/athlete-home"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to athlete
            </Link>

            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
              Clubs
            </p>

            {clubs.map((club) => (
              <Link
                key={club.runClubId}
                href={clubManagerClubPath(club.runClubSlug ?? club.runClubId)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 border border-transparent"
              >
                <Building2 className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
                <span className="truncate">{club.runClubName}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
