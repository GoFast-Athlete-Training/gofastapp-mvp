'use client';

import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from '@/components/gofast-with-me/GoFastWithMeLandingForm';
import GoFastWithMePageSurfacesCard from '@/components/gofast-with-me/GoFastWithMePageSurfacesCard';
import { isWelcomeContentComplete } from '@/components/gofast-with-me/studio-sections';

type Props = {
  landingValues: GoFastWithMeLandingValues;
  profileBio: string | null;
  liveUrl: string;
  appUrl: string;
  publicSlug: string;
  gofastHandle: string;
  slugUsesHandle: boolean;
  isPublishReady: boolean;
  copyDone: boolean;
  onCopyAppUrl: () => void;
  onUrlUpdated: (slug: string, usesHandle: boolean) => void;
  onOpenCommunity: () => void;
  onSaved: (values: GoFastWithMeLandingValues) => void;
};

export default function GoFastWithMeWelcomePanel({
  landingValues,
  profileBio,
  liveUrl,
  appUrl,
  publicSlug,
  gofastHandle,
  slugUsesHandle,
  isPublishReady,
  copyDone,
  onCopyAppUrl,
  onUrlUpdated,
  onOpenCommunity,
  onSaved,
}: Props) {
  const complete = isWelcomeContentComplete(landingValues);

  return (
    <section id="page" className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Page</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your public landing — who you are, run photo, and the URLs visitors use to find you.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
          }`}
        >
          {complete ? 'Complete' : 'Incomplete'}
        </span>
      </div>

      {!complete ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add your welcome message, bio, what visitors will see, and attach a run image to complete
          your landing page health check.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Landing page is complete — share your public URL or open My Workouts to publish your plan.
        </div>
      )}

      <GoFastWithMePageSurfacesCard
        liveUrl={liveUrl}
        appUrl={appUrl}
        publicSlug={publicSlug}
        gofastHandle={gofastHandle}
        slugUsesHandle={slugUsesHandle}
        isPublishReady={isPublishReady}
        copyDone={copyDone}
        onCopyAppUrl={onCopyAppUrl}
        onUrlUpdated={onUrlUpdated}
        onOpenCommunity={onOpenCommunity}
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Landing page</h3>
        <GoFastWithMeLandingForm
          initial={landingValues}
          profileBio={profileBio}
          onSaved={onSaved}
        />
      </div>
    </section>
  );
}
