'use client';

import Link from 'next/link';
import { ArrowLeft, Eye, type LucideIcon } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import {
  STUDIO_BUILD_NAV_ORDER,
  STUDIO_MANAGE_NAV_ORDER,
  STUDIO_MY_STORY_LABEL,
  STUDIO_VIEW_NAV_ORDER,
  STUDIO_VIEW_SECTION_HINT,
  type ContentEditorFocus,
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

export default function GoFastWithMeStudioAppShell({
  activeView,
  contentFocus,
  onViewChange,
  landingNeedsAction,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">My Community</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Build first — preview Landing and Community under View.
            </p>
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

            <div>
              <p className="px-2 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                View
              </p>
              <p className="px-2 pb-1.5 text-[10px] leading-snug text-gray-400">
                {STUDIO_VIEW_SECTION_HINT}
              </p>
              <div className="space-y-0.5">
                {STUDIO_VIEW_NAV_ORDER.map((item) => (
                  <SidebarButton
                    key={item.view}
                    label={item.label}
                    hint={item.hint}
                    icon={Eye}
                    active={activeView === item.view}
                    onClick={() => onViewChange(item.view)}
                    badge={item.view === 'landingView' && landingNeedsAction ? 'action' : undefined}
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
              {STUDIO_VIEW_NAV_ORDER.map((item) => (
                <MobileNavPill
                  key={`m-${item.view}`}
                  label={`Preview ${item.label}`}
                  active={activeView === item.view}
                  onClick={() => onViewChange(item.view)}
                  badge={item.view === 'landingView' && landingNeedsAction}
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
  hint,
  icon: Icon,
  active,
  onClick,
  badge,
}: {
  label: string;
  hint?: string;
  icon?: LucideIcon;
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
      {Icon ? <Icon className="h-4 w-4 shrink-0 mt-0.5 opacity-70" aria-hidden /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint ? <span className="block truncate text-[10px] font-normal text-gray-500">{hint}</span> : null}
      </span>
      {badge === 'action' ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 mt-1.5" aria-hidden />
      ) : null}
    </button>
  );
}
