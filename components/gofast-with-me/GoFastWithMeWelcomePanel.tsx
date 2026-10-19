'use client';

import { useCallback, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from '@/components/gofast-with-me/GoFastWithMeLandingForm';
import { STUDIO_MY_STORY_LABEL } from '@/components/gofast-with-me/studio-sections';

type Props = {
  landingValues: GoFastWithMeLandingValues;
  profileBio: string | null;
  profilePhotoURL: string | null;
  athleteId: string;
  liveUrl: string;
  onSaved: (values: GoFastWithMeLandingValues) => void;
  onAvatarSaved?: (photoURL: string | null) => void;
  onOpenRunnerStory?: () => void;
  runnerStoryPublicUrl?: string | null;
};

export default function GoFastWithMeWelcomePanel({
  landingValues,
  profileBio,
  profilePhotoURL,
  athleteId,
  liveUrl,
  onSaved,
  onAvatarSaved,
  onOpenRunnerStory,
  runnerStoryPublicUrl,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copyLandingUrl = useCallback(async () => {
    if (!liveUrl) return;
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [liveUrl]);

  return (
    <section id="page" className="space-y-6 pb-8 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gray-900">{STUDIO_MY_STORY_LABEL}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your GoFast handle is your public landing — photo, welcome, and about live at that URL.
            Save when you are ready to share.
          </p>
          {liveUrl ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800">
                {liveUrl}
              </code>
              <button
                type="button"
                onClick={() => void copyLandingUrl()}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          ) : null}
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
        </div>
      </div>

      <GoFastWithMeLandingForm
        initial={landingValues}
        profileBio={profileBio}
        profilePhotoURL={profilePhotoURL}
        athleteId={athleteId}
        onSaved={onSaved}
        onAvatarSaved={onAvatarSaved}
        onOpenRunnerStory={onOpenRunnerStory}
        runnerStoryPublicUrl={runnerStoryPublicUrl}
      />
    </section>
  );
}
