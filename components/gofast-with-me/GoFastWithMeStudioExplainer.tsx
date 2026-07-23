'use client';

import { Sparkles, X } from 'lucide-react';

type Props = {
  hasStudioData: boolean;
  onDismiss: () => void;
  onStartSetup?: () => void;
};

export default function GoFastWithMeStudioExplainer({
  hasStudioData,
  onDismiss,
  onStartSetup,
}: Props) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Sparkles className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" aria-hidden />
          <div>
            <h3 className="text-sm font-bold text-gray-900">What is GoFastWithMe Studio?</h3>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">
              This is your creator home — not just an in-app profile. Set up a public landing page,
              share your training, and host a member container where followers see your plan, runs,
              and updates.
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Start with <strong>My Page</strong>, then open <strong>My Workouts</strong>,{' '}
              <strong>My Community</strong>, and <strong>Content</strong> as you grow.
            </p>
          </div>
        </div>
        {hasStudioData ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1 text-gray-500 hover:bg-violet-100 hover:text-gray-800"
            aria-label="Dismiss intro"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 pl-8">
        {!hasStudioData && onStartSetup ? (
          <button
            type="button"
            onClick={onStartSetup}
            className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700"
          >
            Set up your studio
          </button>
        ) : null}
        {hasStudioData ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50"
          >
            Got it
          </button>
        ) : null}
      </div>
    </div>
  );
}
