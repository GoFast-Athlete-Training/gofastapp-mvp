'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MANAGE_COMMUNITY_LABEL } from '@/lib/athlete/community-nav';
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
  linkPageUrl?: string;
  communityHubUrl: string;
};

type Props = {
  activeView: StudioView;
  contentFocus?: ContentEditorFocus | null;
  onViewChange: (view: StudioView, options?: { contentFocus?: ContentEditorFocus }) => void;
  landingNeedsAction?: boolean;
  chromeActions?: StudioChromeActions;
  children: React.ReactNode;
};

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
  activeView,
  contentFocus,
  onViewChange,
  landingNeedsAction,
  chromeActions,
  children,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-gray-200 bg-white shrink-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">Landing & content</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Public landing, athletelinks, and writeups. Host runs from Run; manage followers in
              the hub.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {chromeActions ? (
              <>
                <Link
                  href={chromeActions.communityHubUrl}
                  className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900 hover:bg-sky-100"
                >
                  {MANAGE_COMMUNITY_LABEL}
                </Link>
                <Link
                  href={chromeActions.landingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                >
                  See landing
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
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col min-w-0">
        <div className="border-b border-gray-200 bg-white lg:hidden shrink-0">
          <nav
            className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-hide"
            aria-label="Content navigation"
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
