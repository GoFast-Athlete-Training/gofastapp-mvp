'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Layout,
  LayoutDashboard,
  MapPin,
  PenLine,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import {
  STUDIO_BUILD_CONTENT_SECTIONS,
  STUDIO_CENTRAL_LABEL,
  STUDIO_EARNINGS_SECTIONS,
  STUDIO_MANAGE_SECTIONS,
  STUDIO_NAV_LABELS,
  STUDIO_ROUTES_NAV_LABEL,
  type ContentEditorFocus,
  type StudioSection,
  type StudioView,
} from '@/components/gofast-with-me/studio-sections';

const BUILD_CONTENT_ICONS: Record<StudioSection, LucideIcon> = {
  page: Layout,
  community: PenLine,
  payouts: Wallet,
  workouts: CalendarDays,
  content: BookOpen,
};

type Props = {
  activeView: StudioView;
  contentFocus?: ContentEditorFocus | null;
  onViewChange: (view: StudioView, options?: { contentFocus?: ContentEditorFocus }) => void;
  pageNeedsAction?: boolean;
  children: React.ReactNode;
};

export default function GoFastWithMeStudioAppShell({
  activeView,
  contentFocus,
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
            <p className="text-xs text-gray-500 mt-1">Build content · Manage · Earnings</p>
          </div>

          <nav className="p-2 md:flex-1 md:space-y-1" aria-label="Studio">
            <Link
              href="/athlete-home"
              className="mb-2 flex w-max items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 md:w-full"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Back to home
            </Link>

            <div className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
              <button
                type="button"
                onClick={() => onViewChange('dashboard')}
                className={navButtonClass(activeView === 'dashboard')}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{STUDIO_CENTRAL_LABEL}</span>
              </button>

              <NavGroup label="Build content">
                {STUDIO_BUILD_CONTENT_SECTIONS.map((section) => {
                  if (section === 'content') {
                    return (
                      <div key="build-content-editors" className="space-y-1">
                        <NavSectionButton
                          section="content"
                          label={STUDIO_NAV_LABELS.content}
                          icon={BUILD_CONTENT_ICONS.content}
                          active={activeView === 'content' && contentFocus !== 'route'}
                          onClick={() => onViewChange('content', { contentFocus: 'tip' })}
                        />
                        <NavSectionButton
                          section="content"
                          label={STUDIO_ROUTES_NAV_LABEL}
                          icon={MapPin}
                          active={activeView === 'content' && contentFocus === 'route'}
                          onClick={() => onViewChange('content', { contentFocus: 'route' })}
                        />
                      </div>
                    );
                  }

                  const Icon = BUILD_CONTENT_ICONS[section];
                  return (
                    <NavSectionButton
                      key={section}
                      section={section}
                      label={STUDIO_NAV_LABELS[section]}
                      icon={Icon}
                      active={activeView === section}
                      onClick={() => onViewChange(section)}
                    />
                  );
                })}
              </NavGroup>

              <NavGroup label="Manage">
                {STUDIO_MANAGE_SECTIONS.map((section) => (
                  <NavSectionButton
                    key={section}
                    section={section}
                    label={STUDIO_NAV_LABELS[section]}
                    icon={BUILD_CONTENT_ICONS[section]}
                    active={activeView === section}
                    onClick={() => onViewChange(section)}
                    showActionDot={section === 'page' && pageNeedsAction}
                  />
                ))}
              </NavGroup>

              <NavGroup label="Earnings">
                {STUDIO_EARNINGS_SECTIONS.map((section) => (
                  <NavSectionButton
                    key={section}
                    section={section}
                    label={STUDIO_NAV_LABELS[section]}
                    icon={BUILD_CONTENT_ICONS[section]}
                    active={activeView === section}
                    onClick={() => onViewChange(section)}
                  />
                ))}
              </NavGroup>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 md:mt-3">
      <p className="hidden px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 md:block">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavSectionButton({
  label,
  icon: Icon,
  active,
  onClick,
  showActionDot,
}: {
  section: StudioSection;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  showActionDot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={navButtonClass(active)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
      {showActionDot ? (
        <span className="ml-auto h-2 w-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
      ) : null}
    </button>
  );
}

function navButtonClass(active: boolean): string {
  return `flex min-w-max items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors md:w-full ${
    active
      ? 'bg-orange-50 text-orange-800 border border-orange-200'
      : 'text-gray-700 hover:bg-gray-100 border border-transparent'
  }`;
}
