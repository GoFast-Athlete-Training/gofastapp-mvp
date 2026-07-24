'use client';

import { X } from 'lucide-react';

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
    <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2.5 flex items-start gap-2">
      <p className="text-xs text-violet-950 leading-snug flex-1 min-w-0">
        Your creator home for a public landing, shared training, and a member container. Start with{' '}
        <strong>My Page</strong>, then use the sidebar for workouts, community, and content.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        {!hasStudioData && onStartSetup ? (
          <button
            type="button"
            onClick={onStartSetup}
            className="rounded-md bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
          >
            Set up
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-violet-700 hover:bg-violet-100"
          aria-label="Dismiss intro"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
