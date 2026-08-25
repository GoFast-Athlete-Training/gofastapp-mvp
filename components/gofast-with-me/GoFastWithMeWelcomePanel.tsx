'use client';

import { ExternalLink } from 'lucide-react';
import GoFastWithMeBuildContentStrip from '@/components/gofast-with-me/GoFastWithMeBuildContentStrip';
import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from '@/components/gofast-with-me/GoFastWithMeLandingForm';
import {
  STUDIO_LANDING_LABEL,
  isWelcomeContentComplete,
  type ContentEditorFocus,
  type StudioSection,
} from '@/components/gofast-with-me/studio-sections';

type Props = {
  landingValues: GoFastWithMeLandingValues;
  profileBio: string | null;
  profilePhotoURL: string | null;
  athleteId: string;
  liveUrl: string;
  onSaved: (values: GoFastWithMeLandingValues) => void;
  onAvatarSaved?: (photoURL: string | null) => void;
  onOpenWorkspace: (section: StudioSection, focus?: ContentEditorFocus) => void;
};

export default function GoFastWithMeWelcomePanel({
  landingValues,
  profileBio,
  profilePhotoURL,
  athleteId,
  liveUrl,
  onSaved,
  onAvatarSaved,
  onOpenWorkspace,
}: Props) {
  const complete = isWelcomeContentComplete(landingValues);

  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
      <section id="page" className="space-y-6 lg:col-span-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{STUDIO_LANDING_LABEL}</h2>
            <p className="text-sm text-gray-600 mt-1">
              Your public who-am-I page — photo, welcome, and story before someone follows.
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
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {complete ? 'Complete' : 'Do this first'}
            </span>
          </div>
        </div>

        {!complete ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Finish your landing page first — welcome, about you, what you&apos;ll post, and a run photo.
            Content you build later can show up here as recent highlights.
          </div>
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Landing page looks good — share it and keep adding highlights from Build content.
          </div>
        )}

        <GoFastWithMeLandingForm
          initial={landingValues}
          profileBio={profileBio}
          profilePhotoURL={profilePhotoURL}
          athleteId={athleteId}
          onSaved={onSaved}
          onAvatarSaved={onAvatarSaved}
        />
      </section>

      <GoFastWithMeBuildContentStrip
        surface="landing"
        onOpenWorkspace={onOpenWorkspace}
        className="mt-6 lg:col-span-5 lg:mt-0 lg:sticky lg:top-6"
      />
    </div>
  );
}
