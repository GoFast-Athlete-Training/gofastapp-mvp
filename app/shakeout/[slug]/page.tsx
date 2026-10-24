"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import CityRunDetailsSection from "@/components/runs/CityRunDetailsSection";
import CityRunHostedByStrip from "@/components/runs/CityRunHostedByStrip";
import ShakeoutRegistrationCallout from "@/components/races/ShakeoutRegistrationCallout";
import { useCityRunPageLoad } from "@/components/runs/useCityRunPageLoad";
import { athleteHasCityRunMembership } from "@/lib/city-run/rsvp-attendance";
import { cityRunJoinPath, cityRunTogetherPath } from "@/lib/city-run/run-nav-paths";
import { LocalStorageAPI } from "@/lib/localstorage";
import { auth } from "@/lib/firebase";

/**
 * Public shakeout details — read only. Does not RSVP.
 * I'm in goes to /join/run. Member hub is /cityruntogether after join.
 */
function ShakeoutDetailsInner() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { run, loading, error } = useCityRunPageLoad(slug);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || "Run not found"}</h1>
          <button
            type="button"
            onClick={() => router.push("/races")}
            className="text-orange-500 hover:text-orange-600 font-semibold"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  const key = run.slug?.trim() || run.id;
  const athleteId = LocalStorageAPI.getAthleteId();
  const alreadyIn = Boolean(auth.currentUser) && athleteHasCityRunMembership(run, athleteId);

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <CityRunDetailsSection run={run} />
        <ShakeoutRegistrationCallout
          registrationRequired={run.registrationRequired}
          registrationUrl={run.registrationUrl}
        />
        <CityRunHostedByStrip run={run} />
        <div className="flex flex-wrap items-center gap-3">
          {alreadyIn ? (
            <Link
              href={cityRunTogetherPath(key)}
              className="inline-flex rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Open run
            </Link>
          ) : (
            <Link
              href={cityRunJoinPath(key)}
              className="inline-flex rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              I&apos;m in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShakeoutDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <ShakeoutDetailsInner />
    </Suspense>
  );
}
