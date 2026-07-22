'use client';

import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from '@/components/gofast-with-me/GoFastWithMeLandingForm';
import GoFastWithMeCmsContentSection from '@/components/gofast-with-me/GoFastWithMeContentPanel';
import { isWelcomeContentComplete } from '@/components/gofast-with-me/studio-sections';

type Props = {
  landingValues: GoFastWithMeLandingValues;
  profileBio: string | null;
  liveUrl: string;
  onSaved: (values: GoFastWithMeLandingValues) => void;
};

export default function GoFastWithMeWelcomePanel({
  landingValues,
  profileBio,
  liveUrl,
  onSaved,
}: Props) {
  const complete = isWelcomeContentComplete(landingValues);

  return (
    <section id="welcome" className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">GoFastWithMe CMS</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your public landing page — who you are, what visitors see, and the content that makes
            your page feel alive.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {complete ? 'Complete' : 'Required first'}
        </span>
      </div>

      {!complete ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Required first step.</strong> Add your welcome message, bio, what visitors will
          see, and attach a run image to finish your landing page. Plan and member tools stay locked
          until this is done.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Landing page is complete — next up: Add My Plan to publish your active training plan.
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Landing page</h3>
        <GoFastWithMeLandingForm
          initial={landingValues}
          profileBio={profileBio}
          onSaved={onSaved}
        />
      </div>

      <GoFastWithMeCmsContentSection liveUrl={liveUrl} />
    </section>
  );
}
