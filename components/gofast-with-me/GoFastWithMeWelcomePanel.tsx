'use client';

import { BookOpen, Route } from 'lucide-react';
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
  onOpenFollowers: () => void;
  onOpenMessages: () => void;
  onOpenPlan: () => void;
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
  onOpenFollowers,
  onOpenMessages,
  onOpenPlan,
  onSaved,
}: Props) {
  const complete = isWelcomeContentComplete(landingValues);

  return (
    <section id="page" className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Page</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your public door — welcome copy, run photo, and the story visitors see before they follow.
            What I&apos;m training for hydrates from your goal and plan on the live door.
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
          Landing page is complete — share your public URL, surface your plan, and invite followers.
        </div>
      )}

      <GoFastWithMeLandingForm
        initial={landingValues}
        profileBio={profileBio}
        onSaved={onSaved}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Surface my plan</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Publish your GoFast plan — followers see the plan strip in your hub.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPlan}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-50"
          >
            <Route className="h-3.5 w-3.5" />
            Open plan
          </button>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Messages</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Journey announcements — race updates, milestones, what&apos;s next.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenMessages}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-50"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open Messages
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Public URLs</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Share links and preview surfaces — secondary to your landing content above.
          </p>
        </div>
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
          onOpenCommunity={onOpenFollowers}
        />
      </div>
    </section>
  );
}
