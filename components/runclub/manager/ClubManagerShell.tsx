'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  LayoutDashboard,
  Megaphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

export type ClubManagerNavSection =
  | 'overview'
  | 'content'
  | 'runs'
  | 'announcements';

interface ClubManagerShellProps {
  clubName: string;
  clubSlug: string;
  active: ClubManagerNavSection;
  children: React.ReactNode;
}

const NAV_ITEMS: {
  id: ClubManagerNavSection;
  label: string;
  href: (slug: string) => string;
  icon: LucideIcon;
}[] = [
  { id: 'overview', label: 'Manager home', href: (s) => clubManagerClubPath(s), icon: LayoutDashboard },
  { id: 'content', label: 'Club profile', href: (s) => clubManagerClubPath(s, 'content'), icon: Building2 },
  { id: 'runs', label: 'Runs', href: (s) => clubManagerClubPath(s, 'runs'), icon: Calendar },
  {
    id: 'announcements',
    label: 'Announcements',
    href: (s) => clubManagerClubPath(s, 'announcements'),
    icon: Megaphone,
  },
];

export default function ClubManagerShell({
  clubName,
  clubSlug,
  active,
  children,
}: ClubManagerShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r-2 border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <p className="text-lg font-bold text-gray-900">Club Manager</p>
            <p className="text-xs text-gray-500 mt-1 truncate" title={clubName}>
              {clubName}
            </p>
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
              Manage
            </p>

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href(clubSlug)}
                  className={navButtonClass(isActive)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}

            <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
              Member hub
            </p>

            <Link
              href={`/runclub/${clubSlug}`}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 border border-transparent"
            >
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">View member hub</span>
              <ExternalLink className="h-3.5 w-3.5 ml-auto shrink-0 text-gray-400" aria-hidden />
            </Link>

            <Link
              href={clubManagerHubPath()}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 border border-transparent"
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">All clubs</span>
            </Link>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function navButtonClass(active: boolean): string {
  return `flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    active
      ? 'bg-orange-50 text-orange-800 border border-orange-200'
      : 'text-gray-700 hover:bg-gray-100 border border-transparent'
  }`;
}
