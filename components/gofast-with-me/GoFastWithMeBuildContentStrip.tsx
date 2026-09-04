'use client';

import { BookOpen, PenLine } from 'lucide-react';
import type { ContentEditorFocus, StudioSection } from '@/components/gofast-with-me/studio-sections';

export type StudioContentSurface = 'landing' | 'community';

type Props = {
  surface: StudioContentSurface;
  onOpenWorkspace: (section: StudioSection, focus?: ContentEditorFocus) => void;
  className?: string;
};

const BUILD_CONTENT_ICONS = {
  'Daily log': PenLine,
  Tip: BookOpen,
} as const;

function buildContentActions(surface: StudioContentSurface) {
  const feedHint =
    surface === 'landing'
      ? 'Shows as a recent highlight on your public page.'
      : 'Shows in the member feed.';

  return [
    {
      title: 'Daily log' as const,
      description: `How you're feeling today — ${feedHint.toLowerCase()}`,
      section: 'community' as const,
    },
    {
      title: 'Tip' as const,
      description:
        surface === 'landing'
          ? 'Evergreen training thoughts — can appear as a highlight on your page.'
          : 'Evergreen training thoughts — followers revisit from your tips rail.',
      section: 'content' as const,
      focus: 'tip' as const,
    },
  ] as const;
}

export default function GoFastWithMeBuildContentStrip({
  surface,
  onOpenWorkspace,
  className = '',
}: Props) {
  const actions = buildContentActions(surface);

  return (
    <aside className={`space-y-5 rounded-xl border border-gray-200 bg-white p-5 ${className}`}>
      <div>
        <h3 className="text-sm font-bold text-gray-900">Build content</h3>
        <p className="text-xs text-gray-600 mt-0.5">
          Story, daily log, and tips — runs and training live under Runs and Training.
        </p>
      </div>
      <div className="grid gap-2">
        {actions.map((action) => (
          <BuildContentButton
            key={action.title}
            title={action.title}
            description={action.description}
            onClick={() =>
              onOpenWorkspace(action.section, 'focus' in action ? action.focus : undefined)
            }
          />
        ))}
      </div>
    </aside>
  );
}

function BuildContentButton({
  title,
  description,
  onClick,
}: {
  title: keyof typeof BUILD_CONTENT_ICONS;
  description: string;
  onClick: () => void;
}) {
  const Icon = BUILD_CONTENT_ICONS[title];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition hover:border-orange-200 hover:bg-orange-50"
    >
      <span className="rounded-lg bg-white p-2 text-orange-700 ring-1 ring-gray-200">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </span>
      <span className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">{description}</p>
      </span>
    </button>
  );
}
