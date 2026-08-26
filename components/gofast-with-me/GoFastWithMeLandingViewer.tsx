'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import type { GoFastWithMeLandingValues } from '@/components/gofast-with-me/GoFastWithMeLandingForm';
import {
  STUDIO_LANDING_LABEL,
  STUDIO_MY_STORY_LABEL,
  isWelcomeContentComplete,
  type StudioSection,
} from '@/components/gofast-with-me/studio-sections';
import {
  normalizePhotoFocus,
  clampPhotoZoom,
} from '@/lib/gofast-with-me/photo-focus';

type LandingWidget = 'tips' | 'routes' | 'recentLog' | 'plan';

type Props = {
  landingValues: GoFastWithMeLandingValues;
  liveUrl: string;
  onOpenWorkspace: (section: StudioSection) => void;
};

const WIDGET_OPTIONS: { id: LandingWidget; label: string; description: string }[] = [
  { id: 'tips', label: 'Tips', description: 'Evergreen training thoughts' },
  { id: 'routes', label: 'Routes', description: 'Favorite routes to share' },
  { id: 'recentLog', label: 'Recent log', description: 'Latest daily log entry' },
  { id: 'plan', label: 'Training plan', description: 'Published plan highlight' },
];

export default function GoFastWithMeLandingViewer({
  landingValues,
  liveUrl,
  onOpenWorkspace,
}: Props) {
  const [widgets, setWidgets] = useState<Record<LandingWidget, boolean>>({
    tips: true,
    routes: false,
    recentLog: true,
    plan: false,
  });

  const complete = isWelcomeContentComplete(landingValues);
  const photoFocus = normalizePhotoFocus(
    landingValues.gofastWithMePhotoFocusX,
    landingValues.gofastWithMePhotoFocusY
  );
  const photoZoom = clampPhotoZoom(landingValues.gofastWithMePhotoZoom);

  const toggleWidget = (id: LandingWidget) => {
    setWidgets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{STUDIO_LANDING_LABEL}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Public-door preview — {STUDIO_MY_STORY_LABEL} plus optional highlights for visitors.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100"
            >
              Preview public page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => onOpenWorkspace('page')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit {STUDIO_MY_STORY_LABEL}
          </button>
        </div>
      </div>

      {!complete ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Finish {STUDIO_MY_STORY_LABEL} first — welcome, about, what you&apos;ll post, and a run photo.
          <button
            type="button"
            onClick={() => onOpenWorkspace('page')}
            className="ml-1 font-semibold text-amber-950 underline hover:no-underline"
          >
            Go to editor
          </button>
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">My Story preview</p>
        </div>
        <div className="p-5 space-y-4">
          {landingValues.gofastWithMePhotoUrl ? (
            <div className="relative aspect-[16/9] max-h-48 w-full overflow-hidden rounded-lg bg-gray-100">
              <Image
                src={landingValues.gofastWithMePhotoUrl}
                alt=""
                fill
                className="object-cover"
                style={{
                  objectPosition: `${photoFocus.x}% ${photoFocus.y}%`,
                  transform: `scale(${photoZoom})`,
                }}
                sizes="(max-width: 768px) 100vw, 480px"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              No photo yet — add one in {STUDIO_MY_STORY_LABEL}.
            </div>
          )}
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">
              {landingValues.welcome?.trim() || 'Your welcome headline'}
            </h3>
            {landingValues.gofastWithMeBio?.trim() ? (
              <p className="text-sm text-gray-600 line-clamp-3">{landingValues.gofastWithMeBio}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">About you — not filled in yet.</p>
            )}
            {landingValues.whatYoullSeeHere?.trim() ? (
              <p className="text-xs text-gray-500">{landingValues.whatYoullSeeHere}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Landing widgets</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Optional highlights on your public page — placement only; content comes from Build.
          </p>
        </div>
        <ul className="space-y-2">
          {WIDGET_OPTIONS.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 hover:bg-gray-100/80">
                <input
                  type="checkbox"
                  checked={widgets[option.id]}
                  onChange={() => toggleWidget(option.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span>
                  <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-600 mt-0.5">{option.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          Widget toggles are saved locally for now — wire to landing config in a follow-up.
        </p>
      </section>
    </div>
  );
}
