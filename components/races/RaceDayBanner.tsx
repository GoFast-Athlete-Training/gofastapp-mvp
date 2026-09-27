"use client";

import { useEffect, useState } from "react";
import { X, Flag } from "lucide-react";
import { myRacePlannerHref } from "@/lib/races/athlete-race-signup-display";
import { RacePrepForkActions } from "@/components/races/RacePrepForkActions";

function dismissKey(raceRegistryId: string): string {
  return `gofast.dismissSignupRaceDayBefore.${raceRegistryId}`;
}

export type SignupRaceDayBeforeBannerProps = {
  raceRegistryId: string;
  raceName: string;
  distanceLabel: string | null | undefined;
  slug: string | null | undefined;
};

/**
 * Day-before signup race: prep + link to personal race page for pacing.
 * Session-dismissible per race registry id.
 */
export function SignupRaceDayBeforeBanner({
  raceRegistryId,
  raceName,
  distanceLabel,
  slug,
}: SignupRaceDayBeforeBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissKey(raceRegistryId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [raceRegistryId]);

  if (dismissed) return null;

  const plannerHref = myRacePlannerHref(slug, raceRegistryId);
  const raceHubHref = `/race-hub/${raceRegistryId}`;

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey(raceRegistryId), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      className="mb-4 rounded-2xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50/90 p-5 shadow-sm"
      role="region"
      aria-label="Race tomorrow"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3 min-w-0 pr-10 sm:pr-0">
          <Flag className="h-10 w-10 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-900/90">
              Ready to go? You got this!
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-900">{raceName}</h2>
            {distanceLabel?.trim() ? (
              <p className="text-sm text-amber-950/80">{distanceLabel.trim()}</p>
            ) : null}
            <p className="mt-2 text-sm text-gray-800">
              Finalize your goal pace and set your pacing — then rest up tonight.
            </p>
            <div className="mt-3">
              <RacePrepForkActions
                plannerHref={plannerHref}
                raceHubHref={raceHubHref}
                variant="compact"
                layout="row"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="sm:self-start p-2 rounded-lg text-amber-900 hover:bg-amber-100/80 -mt-1 sm:mt-0"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
