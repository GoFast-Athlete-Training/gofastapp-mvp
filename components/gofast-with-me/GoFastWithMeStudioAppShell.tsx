'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Layout,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import {
  STUDIO_BIN_ORDER,
  STUDIO_CENTRAL_LABEL,
  STUDIO_NAV_LABELS,
  type StudioView,
} from '@/components/gofast-with-me/studio-sections';

const NAV_ICONS: Record<StudioView, LucideIcon> = {
  dashboard: LayoutDashboard,
  page: Layout,
  community: Users,
  workouts: CalendarDays,
  content: BookOpen,
};

type Props = {
  activeView: StudioView;
  onViewChange: (view: StudioView) => void;
  pageNeedsAction?: boolean;
  children: React.ReactNode;
};

export default function GoFastWithMeStudioAppShell({
  activeView,
  onViewChange,
  pageNeedsAction,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
        <aside className="w-full bg-white border-b-2 border-gray-200 flex flex-col shrink-0 md:w-64 md:border-b-0 md:border-r-2 md:overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <p className="text-lg font-bold text-gray-900">My Community</p>
            <p className="text-xs text-gray-500 mt-1">Management · Messages · Runs · Tips</p>
          </div>

          <nav className="p-2 md:flex-1 md:space-y-1" aria-label="Studio">
            <Link
              href="/athlete-home"
              className="mb-2 flex w-max items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 md:w-full"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to home
            </Link>

            <p className="hidden px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 md:block">
              Studio
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
              <button
                type="button"
                onClick={() => onViewChange('dashboard')}
                className={navButtonClass(activeView === 'dashboard')}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{STUDIO_CENTRAL_LABEL}</span>
              </button>

              {STUDIO_BIN_ORDER.map((section) => {
                const Icon = NAV_ICONS[section];
                const active = activeView === section;
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => onViewChange(section)}
                    className={navButtonClass(active)}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{STUDIO_NAV_LABELS[section]}</span>
                    {section === 'page' && pageNeedsAction ? (
                      <span className="ml-auto h-2 w-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function navButtonClass(active: boolean): string {
  return `flex min-w-max items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors md:w-full ${
    active
      ? 'bg-orange-50 text-orange-800 border border-orange-200'
      : 'text-gray-700 hover:bg-gray-100 border border-transparent'
  }`;
}
