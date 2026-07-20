"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { GoFastWithMeCreatorType } from "@/lib/gofast-with-me/gofast-with-me-service";
import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from "@/components/gofast-with-me/GoFastWithMeLandingForm";
import GoFastWithMeHubOnboarding from "@/components/gofast-with-me/GoFastWithMeHubOnboarding";
import GoFastWithMeStudioSidebar from "@/components/gofast-with-me/GoFastWithMeStudioSidebar";

const RUNNER_BASE =
  process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, "") ||
  "https://runner.gofastcrushgoals.com";

type OwnerGwmRow = {
  welcome: string | null;
  gofastWithMeBio: string | null;
  whatYoullSeeHere: string | null;
  sportFocus: string | null;
  modelFocus: string | null;
  myAchievements: string | null;
  gofastWithMePhotoUrl: string | null;
  creatorType: GoFastWithMeCreatorType | null;
  coachSpecialty: string | null;
  gofastSlugSnapshot?: string;
  slugUsesHandle?: boolean;
};

function ownerRowToLanding(row: OwnerGwmRow | null): GoFastWithMeLandingValues {
  return {
    welcome: row?.welcome ?? null,
    gofastWithMeBio: row?.gofastWithMeBio ?? null,
    whatYoullSeeHere: row?.whatYoullSeeHere ?? null,
    sportFocus: row?.sportFocus ?? null,
    modelFocus: row?.modelFocus ?? null,
    myAchievements: row?.myAchievements ?? null,
    gofastWithMePhotoUrl: row?.gofastWithMePhotoUrl ?? null,
  };
}

export default function GoFastWithOthersDashboard() {
  const router = useRouter();
  const [gofastHandle, setGofastHandle] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState<string | null>(null);
  const [ownerGwm, setOwnerGwm] = useState<OwnerGwmRow | null>(null);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [slugUsesHandle, setSlugUsesHandle] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [noHandle, setNoHandle] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace("/welcome");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [profileRes, gwmRes] = await Promise.all([
          api.get(`/athlete/${id}`),
          api.get("/me/gofast-with-me"),
        ]);
        const athlete = profileRes.data?.athlete;
        const handle = athlete?.gofastHandle?.trim();
        if (!handle) {
          if (!cancelled) {
            setNoHandle(true);
            setLoading(false);
          }
          return;
        }
        setGofastHandle(handle);
        setFirstName(athlete?.firstName ?? null);
        setProfileBio(athlete?.bio ?? null);

        const gwm = gwmRes.data?.gofastWithMe as OwnerGwmRow | null;
        setOwnerGwm(gwm);
        const slug = gwm?.gofastSlugSnapshot ?? handle;
        setPublicSlug(slug);
        setSlugUsesHandle(gwm?.slugUsesHandle ?? true);
        setShowOnboarding(!gwm?.creatorType);

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading GoFast with Others.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const copyAppUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, []);

  const landingValues = ownerRowToLanding(ownerGwm);

  const isPublishReady = Boolean(
    landingValues.welcome?.trim() ||
      landingValues.gofastWithMeBio?.trim() ||
      landingValues.whatYoullSeeHere?.trim()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (noHandle) {
    return (
      <div className="max-w-lg space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
          GoFast with Others
        </p>
        <h1 className="text-2xl font-bold text-gray-900">GoFastWithMe studio</h1>
        <p className="text-gray-700 text-sm">
          Set your GoFast handle first — then you can build your public landing.
        </p>
        <Link
          href="/athlete-edit-profile?tab=profile-info"
          className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Go to Profile Info
        </Link>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <GoFastWithMeHubOnboarding
        onComplete={({ creatorType, coachSpecialty }) => {
          setOwnerGwm((prev) =>
            prev
              ? { ...prev, creatorType, coachSpecialty }
              : {
                  welcome: null,
                  gofastWithMeBio: null,
                  whatYoullSeeHere: null,
                  sportFocus: null,
                  modelFocus: null,
                  myAchievements: null,
                  gofastWithMePhotoUrl: null,
                  creatorType,
                  coachSpecialty,
                }
          );
          setShowOnboarding(false);
        }}
      />
    );
  }

  if (!gofastHandle || !publicSlug) {
    return (
      <div className="max-w-lg space-y-4">
        <p className="text-gray-700">{error || "Studio unavailable."}</p>
      </div>
    );
  }

  const liveUrl = `${RUNNER_BASE}/${publicSlug}`;
  const appUrl = `/u/${publicSlug}`;
  const visitorHeadline = firstName ? `GoFast with ${firstName}` : "Your public page";
  const creatorLabel =
    ownerGwm?.creatorType === "coach"
      ? "Coach"
      : ownerGwm?.creatorType === "person"
        ? "Athlete"
        : null;

  return (
    <div className="space-y-6 pb-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600 mb-1">
            GoFast with Others
          </p>
          <h1 className="text-2xl font-bold text-gray-900">GoFastWithMe studio</h1>
          <p className="text-gray-600 text-sm mt-1 max-w-xl">
            Edit your public landing identity. Use the sidebar to publish, connect runs and plans,
            and track earnings.
          </p>
        </div>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100"
        >
          View {visitorHeadline} →
        </a>
      </div>

      {creatorLabel ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Creator type
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{creatorLabel}</p>
            {ownerGwm?.creatorType === "coach" && ownerGwm.coachSpecialty?.trim() ? (
              <p className="text-sm text-gray-600 mt-1">{ownerGwm.coachSpecialty.trim()}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit creator type
          </button>
        </div>
      ) : null}

      {!isPublishReady ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add a welcome and GoFastWithMe bio so visitors know how to join you — then publish from
          the sidebar.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <GoFastWithMeStudioSidebar
          liveUrl={liveUrl}
          appUrl={appUrl}
          publicSlug={publicSlug}
          gofastHandle={gofastHandle}
          slugUsesHandle={slugUsesHandle}
          isPublishReady={isPublishReady}
          copyDone={copyDone}
          onCopyAppUrl={() => void copyAppUrl(`${window.location.origin}${appUrl}`)}
          onUrlUpdated={(slug, usesHandle) => {
            setPublicSlug(slug);
            setSlugUsesHandle(usesHandle);
          }}
        />

        <div className="min-w-0 flex-1">
          <GoFastWithMeLandingForm
            initial={landingValues}
            profileBio={profileBio}
            onSaved={(values) => {
              setOwnerGwm((prev) => (prev ? { ...prev, ...values } : prev));
            }}
          />
        </div>
      </div>
    </div>
  );
}
