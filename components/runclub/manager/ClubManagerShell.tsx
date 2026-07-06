'use client';

import Link from 'next/link';
import TopNav from '@/components/shared/TopNav';
import {
  CLUB_MANAGER_BASE,
  clubManagerClubPath,
  clubManagerHubPath,
} from '@/lib/club-manager-paths';

interface ClubManagerShellProps {
  clubName: string;
  clubSlug: string;
  active: 'overview' | 'content' | 'runs' | 'announcements';
  children: React.ReactNode;
}

const primaryTabs: {
  id: ClubManagerShellProps['active'];
  label: string;
  href: (slug: string) => string;
}[] = [
  { id: 'overview', label: 'Manager home', href: (s) => clubManagerClubPath(s) },
  { id: 'content', label: 'Club profile', href: (s) => clubManagerClubPath(s, 'content') },
  { id: 'runs', label: 'Runs', href: (s) => clubManagerClubPath(s, 'runs') },
];

const secondaryTab = {
  id: 'announcements' as const,
  label: 'Announcements',
  href: (s: string) => clubManagerClubPath(s, 'announcements'),
};

export default function ClubManagerShell({
  clubName,
  clubSlug,
  active,
  children,
}: ClubManagerShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-orange-600 font-semibold uppercase tracking-wide">
                Club Manager
              </p>
              <h1 className="text-2xl font-bold text-gray-900">{clubName}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/runclub/${clubSlug}`}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-200"
              >
                Member view
              </Link>
              <Link
                href={clubManagerHubPath()}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-200"
              >
                All clubs
              </Link>
              <Link
                href="/athlete-home"
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-200"
              >
                Athlete home
              </Link>
            </div>
          </div>
          <nav className="mt-6 flex flex-wrap items-end gap-1 border-b border-gray-100 -mb-px">
            {primaryTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href(clubSlug)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </Link>
            ))}
            <Link
              href={secondaryTab.href(clubSlug)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active === secondaryTab.id
                  ? 'border-gray-400 text-gray-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {secondaryTab.label}
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

export { CLUB_MANAGER_BASE };
