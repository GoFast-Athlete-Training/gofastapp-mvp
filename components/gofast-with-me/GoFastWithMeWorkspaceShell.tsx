'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import {
  STUDIO_BIN_LABELS,
  STUDIO_BIN_ORDER,
  type StudioSection,
} from '@/components/gofast-with-me/studio-sections';

type Props = {
  activeSection: StudioSection;
  onSectionChange: (section: StudioSection) => void;
  onBackToDashboard: () => void;
  children: React.ReactNode;
};

export default function GoFastWithMeWorkspaceShell({
  activeSection,
  onSectionChange,
  onBackToDashboard,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </button>
        <nav
          className="flex flex-wrap items-center gap-1 text-xs text-gray-500"
          aria-label="Workspace navigation"
        >
          <Link
            href="/gofast-with-others"
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
          <span className="font-semibold text-gray-900">{STUDIO_BIN_LABELS[activeSection]}</span>
        </nav>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {STUDIO_BIN_ORDER.map((section) => {
          const active = section === activeSection;
          return (
            <button
              key={section}
              type="button"
              onClick={() => onSectionChange(section)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-orange-100 text-orange-900'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {STUDIO_BIN_LABELS[section]}
            </button>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
