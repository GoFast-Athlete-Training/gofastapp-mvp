'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import {
  STUDIO_BUILD_NAV_ORDER,
  STUDIO_CHROME_LABELS,
  STUDIO_MANAGE_NAV_ORDER,
  STUDIO_MY_STORY_LABEL,
  isStudioChromeView,
  type ContentEditorFocus,
  type StudioChromeView,
  type StudioSection,
  type StudioView,
} from '@/components/gofast-with-me/studio-sections';

type Props = {
  activeView: StudioView;
  contentFocus?: ContentEditorFocus | null;
  onViewChange: (view: StudioView, options?: { contentFocus?: ContentEditorFocus }) => void;
  landingNeedsAction?: boolean;
  children: React.ReactNode;
};

function isBuildNavActive(
  activeView: StudioView,
  contentFocus: ContentEditorFocus | null | undefined,
  section: StudioSection,
  focus?: ContentEditorFocus
): boolean {
  if (activeView !== section) return false;
  if (section === 'content') return (contentFocus ?? 'tip') === (focus ?? 'tip');
  return true;
}

const CHROME_VIEWS: StudioChromeView[] = ['landingView', 'communityHome'];

export default function GoFastWithMeStudioAppShell({
  activeView,
  contentFocus,
  onViewChange,
  landingNeedsAction,
  children,
}: Props) {
  const chromeActive = isStudioChromeView(activeView);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div>
              <p className="text-lg font-bold text-gray-900">My Community</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Build on the left — flip Landing or Community in the header.
              </p>
            </div>
            <div
              className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 self-start"
              role="tablist"
              aria-label="View"
            >
              {CHROME_VIEWS.map((view) => {
                const active = activeView === view;
                const needsAction = view === 'landingView' && landingNeedsAction;
                return (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onViewChange(view)}
                    className={`relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-white text-orange-900 shadow-sm'
                        : chromeActive
                          ? 'text-gray-600 hover:text-gray-900'
                          : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {STUDIO_CHROME_LABELS[view]}
                    {needsAction ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <Link
            href="/athlete-home"
            className="inline-flex items-center gap-1.5 self-start rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 sm:self-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Back
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white lg:block">
          <nav className="sticky top-0 max-h-[calc(100vh-8rem)] overflow-y-auto px-3 py-4 space-y-5">
            <div>
              <SidebarButton
                label={STUDIO_MY_STORY_LABEL}
                active={activeView === 'page'}
                onClick={() => onViewChange('page')}
                badge={landingNeedsAction ? 'action' : undefined}
              />
            </div>

            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Build
              </p>
              <div className="space-y-0.5">
                {STUDIO_BUILD_NAV_ORDER.map((item) => (
                  <SidebarButton
                    key={`${item.section}-${item.focus ?? 'default'}`}
                    label={item.label}
                    active={isBuildNavActive(activeView, contentFocus, item.section, item.focus)}
                    onClick={() =>
                      onViewChange(item.section, item.focus ? { contentFocus: item.focus } : undefined)
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Manage
              </p>
              <div className="space-y-0.5">
                {STUDIO_MANAGE_NAV_ORDER.map((item) => (
                  <SidebarButton
                    key={item.section}
                    label={item.label}
                    active={activeView === item.section}
                    onClick={() => onViewChange(item.section)}
                  />
                ))}
              </div>
            </div>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-gray-200 bg-white lg:hidden">
            <nav
              className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-hide"
              aria-label="Studio navigation"
            >
              <MobileNavPill
                label={STUDIO_MY_STORY_LABEL}
                active={activeView === 'page'}
                onClick={() => onViewChange('page')}
                badge={landingNeedsAction}
              />
              {STUDIO_BUILD_NAV_ORDER.map((item) => (
                <MobileNavPill
                  key={`m-${item.section}-${item.focus ?? 'default'}`}
                  label={item.label}
                  active={isBuildNavActive(activeView, contentFocus, item.section, item.focus)}
                  onClick={() =>
                    onViewChange(item.section, item.focus ? { contentFocus: item.focus } : undefined)
                  }
                />
              ))}
              {STUDIO_MANAGE_NAV_ORDER.map((item) => (
                <MobileNavPill
                  key={`m-${item.section}`}
                  label={item.label}
                  active={activeView === item.section}
                  onClick={() => onViewChange(item.section)}
                />
              ))}
            </nav>
          </div>

          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

function MobileNavPill({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'bg-orange-100 text-orange-900' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {label}
      {badge ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden /> : null}
    </button>
  );
}

function SidebarButton({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: 'action';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
        active
          ? 'bg-orange-50 text-orange-900'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
      </span>
      {badge === 'action' ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 mt-1.5" aria-hidden />
      ) : null}
    </button>
  );
}
