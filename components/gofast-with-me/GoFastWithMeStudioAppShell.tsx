'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import TopNav from '@/components/shared/TopNav';
import {
  STUDIO_CHROME_LABELS,
  STUDIO_CHROME_VIEWS,
  chromeViewForEditor,
  isStudioChromeView,
  type ContentEditorFocus,
  type StudioChromeView,
  type StudioView,
} from '@/components/gofast-with-me/studio-sections';

type Props = {
  activeView: StudioView;
  onViewChange: (view: StudioView, options?: { contentFocus?: ContentEditorFocus }) => void;
  landingNeedsAction?: boolean;
  children: React.ReactNode;
};

export default function GoFastWithMeStudioAppShell({
  activeView,
  onViewChange,
  landingNeedsAction,
  children,
}: Props) {
  const highlightedChrome: StudioChromeView = isStudioChromeView(activeView)
    ? activeView
    : chromeViewForEditor(activeView);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900">My Community</p>
            <p className="text-xs text-gray-500 mt-0.5">
              One content pool — Landing and Community show it differently.
            </p>
          </div>
          <nav
            className="flex flex-wrap items-center gap-2"
            aria-label="Studio surfaces"
          >
            <Link
              href="/athlete-home"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Back
            </Link>
            {STUDIO_CHROME_VIEWS.map((view) => {
              const active = highlightedChrome === view;
              return (
                <button
                  key={view}
                  type="button"
                  onClick={() => onViewChange(view)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-orange-50 text-orange-800 border border-orange-200'
                      : 'text-gray-700 border border-transparent hover:bg-gray-100'
                  }`}
                >
                  {STUDIO_CHROME_LABELS[view]}
                  {view === 'page' && landingNeedsAction ? (
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
