'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
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
  workouts: Calendar,
  community: Users,
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
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 bg-white border-r-2 border-gray-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <p className="text-lg font-bold text-gray-900">GoFastWithMe Studio</p>
            <p className="text-xs text-gray-500 mt-1">Your public community hub</p>
          </div>

          <nav className="flex-1 p-2 space-y-1" aria-label="Studio">
            <Link
              href="/athlete-home"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to home
            </Link>

            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
              Studio
            </p>

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
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function navButtonClass(active: boolean): string {
  return `flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-left transition-colors ${
    active
      ? 'bg-orange-50 text-orange-800 border border-orange-200'
      : 'text-gray-700 hover:bg-gray-100 border border-transparent'
  }`;
}
