'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Link2,
  Map,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import {
  STUDIO_CONTENT_NAV_ORDER,
  type ContentEditorFocus,
  type StudioSection,
  type StudioView,
} from '@/components/gofast-with-me/studio-sections';

export type StudioChromeActions = {
  landingUrl: string;
  inviteUrl: string;
  onShare: () => void;
  shareLabel?: string;
  /** Public athletelinks URL when the athlete has a handle. */
  linkPageUrl?: string;
  /** Owner hub — Manage Community door. */
  communityHubUrl: string;
};

type Props = {
  phase: 'entry' | 'content';
  onEnterContent: () => void;
  onBackToDoors: () => void;
  activeView: StudioView;
  contentFocus?: ContentEditorFocus | null;
  onViewChange: (view: StudioView, options?: { contentFocus?: ContentEditorFocus }) => void;
  landingNeedsAction?: boolean;
  chromeActions?: StudioChromeActions;
  /** Entry phase: show only children (onboarding), not door cards. */
  suppressDoors?: boolean;
  children: React.ReactNode;
};

const CONTENT_NAV_ICONS: Record<string, LucideIcon> = {
  'page-default': UserRound,
  'runnerStory-default': BookOpen,
  'content-route': Map,
  'reflections-default': NotebookPen,
  'content-tip': PenLine,
  'linkTree-default': Link2,
};

function navItemKey(section: StudioSection, focus?: ContentEditorFocus): string {
  if (section === 'content') return `content-${focus ?? 'tip'}`;
  return `${section}-default`;
}

function isNavItemActive(
  activeView: StudioView,
  contentFocus: ContentEditorFocus | null | undefined,
  section: StudioSection,
  focus?: ContentEditorFocus
): boolean {
  if (activeView !== section) return false;
  if (section === 'content') {
    return (contentFocus ?? 'tip') === (focus ?? 'tip');
  }
  return true;
}

export default function GoFastWithMeStudioAppShell({
  phase,
  onEnterContent,
  onBackToDoors,
  activeView,
  contentFocus,
  onViewChange,
  landingNeedsAction,
  chromeActions,
  suppressDoors = false,
  children,
}: Props) {
  const [railCollapsed, setRailCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">My Community</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {phase === 'entry'
                ? 'Build content for your landing, or manage your follower hub.'
                : 'Content studio — what shows on your public landing and athletelinks.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {phase === 'content' ? (
              <button
                type="button"
                onClick={onBackToDoors}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to doors
              </button>
            ) : null}
            {chromeActions ? (
              <>
                <Link
                  href={chromeActions.landingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                >
                  See Landing Page
                </Link>
                {chromeActions.linkPageUrl ? (
                  <Link
                    href={chromeActions.linkPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    See link page
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={chromeActions.onShare}
                  className="inline-flex rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700"
                >
                  {chromeActions.shareLabel ?? 'Share link'}
                </button>
              </>
            ) : null}
            <Link
              href="/athlete-home"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Back
            </Link>
          </div>
        </div>
      </header>

      {phase === 'entry' ? (
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 space-y-6">
            {children}
            {suppressDoors ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={onEnterContent}
                className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 text-left shadow-sm hover:border-orange-300 transition-colors"
              >
                <PenLine className="h-8 w-8 text-orange-700 mb-3" />
                <h2 className="text-lg font-bold text-gray-900">Build Content</h2>
                <p className="text-sm text-gray-600 mt-2">
                  My Story, runner story, routes, reflections, think pieces, and your link tree.
                </p>
                <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-orange-800">
                  Open content studio
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
              {chromeActions ? (
                <Link
                  href={chromeActions.communityHubUrl}
                  className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 text-left shadow-sm hover:border-sky-300 transition-colors block"
                >
                  <Users className="h-8 w-8 text-sky-700 mb-3" />
                  <h2 className="text-lg font-bold text-gray-900">Manage Community</h2>
                  <p className="text-sm text-gray-600 mt-2">
                    Your follower hub — feed, runs, people, and chatter. You enter as yourself.
                  </p>
                  <span className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-sky-800">
                    Open hub
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              ) : null}
            </div>
            )}
          </div>
        </main>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside
            className={`hidden shrink-0 border-r border-gray-200 bg-white lg:block transition-[width] ${
              railCollapsed ? 'w-[4.25rem]' : 'w-56'
            }`}
          >
            <nav className="sticky top-0 max-h-[calc(100vh-8rem)] overflow-y-auto px-2 py-4">
              <div className="flex items-center justify-between px-1 pb-2">
                {!railCollapsed ? (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 px-1">
                    Build content
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setRailCollapsed((c) => !c)}
                  className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 ml-auto"
                  aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {railCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="space-y-0.5">
                {STUDIO_CONTENT_NAV_ORDER.map((item) => {
                  const Icon = CONTENT_NAV_ICONS[navItemKey(item.section, item.focus)] ?? PenLine;
                  const active = isNavItemActive(
                    activeView,
                    contentFocus,
                    item.section,
                    item.focus
                  );
                  return (
                    <SidebarButton
                      key={`${item.section}-${item.focus ?? 'default'}-${item.label}`}
                      label={item.label}
                      icon={Icon}
                      collapsed={railCollapsed}
                      active={active}
                      onClick={() =>
                        onViewChange(
                          item.section,
                          item.focus ? { contentFocus: item.focus } : undefined
                        )
                      }
                      badge={item.section === 'page' && landingNeedsAction ? 'action' : undefined}
                    />
                  );
                })}
              </div>
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-gray-200 bg-white lg:hidden">
              <nav
                className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-hide"
                aria-label="Content studio navigation"
              >
                {STUDIO_CONTENT_NAV_ORDER.map((item) => (
                  <MobileNavPill
                    key={`m-${item.section}-${item.focus ?? 'default'}`}
                    label={item.label}
                    active={isNavItemActive(activeView, contentFocus, item.section, item.focus)}
                    onClick={() =>
                      onViewChange(
                        item.section,
                        item.focus ? { contentFocus: item.focus } : undefined
                      )
                    }
                    badge={item.section === 'page' ? landingNeedsAction : undefined}
                  />
                ))}
              </nav>
            </div>

            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      )}
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
  icon: Icon,
  collapsed,
  active,
  onClick,
  badge,
}: {
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  active: boolean;
  onClick: () => void;
  badge?: 'action';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
        active ? 'bg-orange-50 text-orange-900' : 'text-gray-700 hover:bg-gray-100'
      } ${collapsed ? 'justify-center px-2' : ''}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      ) : null}
      {!collapsed && badge === 'action' ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
      ) : null}
    </button>
  );
}
