"use client";

import Link from "next/link";
import { formatRaceListDate } from "@/lib/races-display";

export type SecondaryRaceCandidate = {
  athleteRaceId: string;
  /** @deprecated alias */
  signupId: string;
  raceRegistryId: string;
  race: {
    name: string;
    raceDate: string;
    distanceLabel: string | null;
  };
};

type PlanSecondaryRacesReviewProps = {
  candidates: SecondaryRaceCandidate[];
  includedSignupIds: Set<string>;
  onToggle: (athleteRaceId: string, included: boolean) => void;
  goalRaceName?: string | null;
};

export default function PlanSecondaryRacesReview({
  candidates,
  includedSignupIds,
  onToggle,
  goalRaceName,
}: PlanSecondaryRacesReviewProps) {
  if (candidates.length === 0) return null;

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-gray-800">
      <p className="font-medium text-gray-900">Races we found in your build</p>
      <p className="mt-2 leading-relaxed text-gray-700">
        These races fall between your plan start and
        {goalRaceName ? ` ${goalRaceName}` : " your goal race"}. We&apos;ll treat each included
        race as a real race effort — adjusting long runs, quality work, and recovery around them.
      </p>
      <ul className="mt-4 space-y-2">
        {candidates.map((c) => {
          const included = includedSignupIds.has(c.athleteRaceId);
          return (
            <li
              key={c.athleteRaceId}
              className="flex items-start gap-3 rounded-lg border border-sky-100 bg-white px-3 py-2.5"
            >
              <input
                type="checkbox"
                id={`secondary-race-${c.athleteRaceId}`}
                className="mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                checked={included}
                onChange={(e) => onToggle(c.athleteRaceId, e.target.checked)}
              />
              <label htmlFor={`secondary-race-${c.athleteRaceId}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="font-semibold text-gray-900">{c.race.name}</span>
                <span className="block text-xs text-gray-600 mt-0.5">
                  {formatRaceListDate(c.race.raceDate)}
                  {c.race.distanceLabel ? ` · ${c.race.distanceLabel}` : ""}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type AdjustPlanPromptProps = {
  planId: string;
  weekNumber: number | null;
  raceName: string;
  impactSummary?: string[];
  onDismiss?: () => void;
};

export function AdjustPlanPrompt({
  planId,
  weekNumber,
  raceName,
  impactSummary,
  onDismiss,
}: AdjustPlanPromptProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-medium text-amber-950">
        {raceName} lands in your active plan
        {weekNumber != null ? ` (week ${weekNumber})` : ""}.
      </p>
      {impactSummary && impactSummary.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/95">
          {impactSummary.slice(0, 3).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-amber-900/90">
          We can adjust your schedule around this race without changing your goal-race blueprint.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/training-setup/${encodeURIComponent(planId)}?adjustRace=1`}
          className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
        >
          Adjust my plan
        </Link>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100/80"
          >
            Not now
          </button>
        ) : null}
      </div>
    </div>
  );
}
