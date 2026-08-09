'use client';

import { ExternalLink, Pencil } from 'lucide-react';
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
  creatorLabel?: string | null;
  coachSpecialty?: string | null;
  onEditCreatorType?: () => void;
  onSaved: (values: GoFastWithMeLandingValues) => void;
  onAvatarSaved?: (photoURL: string | null) => void;
};

export default function GoFastWithMeWelcomePanel({
  landingValues,
  profileBio,
  profilePhotoURL,
  athleteId,
  liveUrl,
  creatorLabel,
  coachSpecialty,
  onEditCreatorType,
  onSaved,
  onAvatarSaved,
}: Props) {
  const complete = isWelcomeContentComplete(landingValues);

  return (
    <section id="page" className="space-y-5 sm:space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Page Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Public page copy, photo, and who you show up as.
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

      {creatorLabel && onEditCreatorType ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Creator type
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {creatorLabel}
              {coachSpecialty?.trim() ? (
                <span className="font-normal text-gray-600"> · {coachSpecialty.trim()}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onEditCreatorType}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      ) : null}

      {!complete ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a welcome, about you, what you&apos;ll post, and a run image to finish your landing page.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Landing page looks good — share your invite link from Home when you&apos;re ready.
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
