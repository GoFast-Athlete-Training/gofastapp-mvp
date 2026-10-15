'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BUILD_CONTENT_PATH, MANAGE_COMMUNITY_LABEL } from '@/lib/athlete/community-nav';
import { STUDIO_NAV_LABELS, type StudioSection } from '@/components/gofast-with-me/studio-sections';

export type StudioChromeActions = {
  landingUrl: string;
  inviteUrl: string;
  onShare: () => void;
  shareLabel?: string;
  linkPageUrl?: string;
  communityHubUrl: string;
};

type Props = {
  editorSection: StudioSection;
  editorFocus?: 'tip' | 'route' | null;
  chromeActions?: StudioChromeActions;
  children: React.ReactNode;
};

export default function GoFastWithMeStudioAppShell({
  editorSection,
  editorFocus,
  chromeActions,
  children,
}: Props) {
  const title =
    editorSection === 'content'
      ? editorFocus === 'route'
        ? 'Routes'
        : 'Think Pieces'
      : STUDIO_NAV_LABELS[editorSection];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-gray-200 bg-white shrink-0">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              href={BUILD_CONTENT_PATH}
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              ← Build content
            </Link>
            <p className="text-lg font-bold text-gray-900 mt-1">{title}</p>
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

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
