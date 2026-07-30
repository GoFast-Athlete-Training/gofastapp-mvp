'use client';

import { ExternalLink } from 'lucide-react';
import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from '@/components/gofast-with-me/GoFastWithMeLandingForm';
import { isWelcomeContentComplete } from '@/components/gofast-with-me/studio-sections';

type Props = {
  landingValues: GoFastWithMeLandingValues;
  profileBio: string | null;
  profilePhotoURL: string | null;
  athleteId: string;
  liveUrl: string;
  onSaved: (values: GoFastWithMeLandingValues) => void;
  onAvatarSaved?: (photoURL: string | null) => void;
};

export default function GoFastWithMeWelcomePanel({
  landingValues,
  profileBio,
  profilePhotoURL,
  athleteId,
  liveUrl,
  onSaved,
  onAvatarSaved,
}: Props) {
  const complete = isWelcomeContentComplete(landingValues);

  return (
    <section id="page" className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Page</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your public page — welcome copy, run photo, and the story visitors see before they follow.
            What I&apos;m training for comes from your goal and plan on the live page.
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
              View public page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            }`}
          >
            {complete ? 'Complete' : 'Incomplete'}
          </span>
        </div>
      </div>

      {!complete ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a welcome, about you, what you&apos;ll post, and a run image to finish your landing page.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Landing page looks good — share your page from Studio Central when you&apos;re ready.
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
  );
}
