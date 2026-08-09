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
  STUDIO_MOBILE_NAV_LABELS,
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
        <aside className="w-full bg-white border-b border-gray-200 flex flex-col shrink-0 md:w-64 md:border-b-0 md:border-r-2 md:overflow-y-auto">
          <div className="px-4 pt-3 pb-2 md:p-4 md:border-b md:border-gray-200">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                  Manage and engage your community
                </h1>
              </div>
              <Link
                href="/athlete-home"
                className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 md:hidden"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Home
              </Link>
            </div>
          </div>

          <nav className="px-2 pb-2 md:p-2 md:flex-1 md:space-y-1" aria-label="Studio">
            <Link
              href="/athlete-home"
              className="mb-2 hidden w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 md:flex"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to home
            </Link>

            <p className="hidden px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 md:block">
              Studio
            </p>

            <div className="grid grid-cols-5 gap-1 md:block md:space-y-1">
              <button
                type="button"
                onClick={() => onViewChange('dashboard')}
                className={navButtonClass(activeView === 'dashboard')}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate md:hidden">{STUDIO_MOBILE_NAV_LABELS.dashboard}</span>
                <span className="hidden truncate md:inline">{STUDIO_NAV_LABELS.dashboard}</span>
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
                    <span className="truncate md:hidden">{STUDIO_MOBILE_NAV_LABELS[section]}</span>
                    <span className="hidden truncate md:inline">{STUDIO_NAV_LABELS[section]}</span>
                    {section === 'page' && pageNeedsAction ? (
                      <span
                        className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 md:static md:ml-auto md:h-2 md:w-2"
                        aria-hidden
                      />
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
  return `relative flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-[11px] font-semibold transition-colors md:flex-row md:w-full md:justify-start md:gap-2.5 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${
    active
      ? 'bg-orange-50 text-orange-800 border border-orange-200'
      : 'text-gray-600 hover:bg-gray-100 border border-transparent'
  }`;
}
