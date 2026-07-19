"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { GoFastWithMeCreatorType } from "@/lib/gofast-with-me/gofast-with-me-service";
import GoFastPagePreviewCard, {
  type GoFastPagePayload,
} from "@/components/profile/GoFastPagePreviewCard";
import PersonalCommunityCard from "@/components/profile/PersonalCommunityCard";
import { AdvertisingEarningsPanel } from "@/components/advertising/AdvertisingEarningsPanel";
import GoFastWithMeLandingForm, {
  type GoFastWithMeLandingValues,
} from "@/components/gofast-with-me/GoFastWithMeLandingForm";
import GoFastWithMeUrlEditor from "@/components/profile/GoFastWithMeUrlEditor";
import GoFastWithMeHubOnboarding from "@/components/gofast-with-me/GoFastWithMeHubOnboarding";

const RUNNER_BASE =
  process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, "") ||
  "https://runner.gofastcrushgoals.com";

const AUTO_MODULES = [
  "Next race",
  "Training plan",
  "Public runs",
  "Community",
  "Group training",
] as const;

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
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [gofastHandle, setGofastHandle] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState<string | null>(null);
  const [isGoFastContainer, setIsGoFastContainer] = useState(false);
  const [ownerGwm, setOwnerGwm] = useState<OwnerGwmRow | null>(null);
  const [payload, setPayload] = useState<GoFastPagePayload | null>(null);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [slugUsesHandle, setSlugUsesHandle] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [noHandle, setNoHandle] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const refreshPublicPreview = useCallback(async (slug: string) => {
    const pubRes = await fetch(`/api/athlete/public/${encodeURIComponent(slug)}`);
    const data = (await pubRes.json()) as GoFastPagePayload & { error?: string };
    if (pubRes.ok && data.success && data.athlete) {
      setPayload(data);
    }
  }, []);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace("/welcome");
      return;
    }
    setAthleteId(id);

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
        setProfileBio(athlete?.bio ?? null);
        setIsGoFastContainer(!!athlete?.isGoFastContainer);

        const gwm = gwmRes.data?.gofastWithMe as OwnerGwmRow | null;
        setOwnerGwm(gwm);
        const slug = gwm?.gofastSlugSnapshot ?? handle;
        setPublicSlug(slug);
        setSlugUsesHandle(gwm?.slugUsesHandle ?? true);
        setShowOnboarding(!gwm?.creatorType);

        const pubRes = await fetch(`/api/athlete/public/${encodeURIComponent(slug)}`);
        const data = (await pubRes.json()) as GoFastPagePayload & { error?: string };
        if (!pubRes.ok || !data.success || !data.athlete) {
          if (!cancelled) {
            setError(data.error || "Could not load your GoFastWithMe preview.");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) {
          setPayload(data);
          setLoading(false);
        }
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

  const copyPublicUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const landingValues = ownerRowToLanding(ownerGwm);

  const hasLandingCopy = Boolean(
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

  if (error && !payload) {
    return (
      <div className="max-w-lg space-y-4">
        <p className="text-gray-700">{error}</p>
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
          setPayload((prev) =>
            prev
              ? {
                  ...prev,
                  gofastWithMe: {
                    ...prev.gofastWithMe,
                    creatorType,
                    coachSpecialty,
                  },
                }
              : prev
          );
          setShowOnboarding(false);
          if (publicSlug) {
            void refreshPublicPreview(publicSlug);
          }
        }}
      />
    );
  }

  if (!payload?.athlete || !gofastHandle || !publicSlug) {
    return (
      <div className="max-w-lg space-y-4">
        <p className="text-gray-700">Preview unavailable.</p>
      </div>
    );
  }

  const liveUrl = `${RUNNER_BASE}/${publicSlug}`;
  const appUrl = `/u/${publicSlug}`;
  const visitorHeadline = payload.athlete.firstName
    ? `GoFast with ${payload.athlete.firstName}`
    : "Your public page";
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
            Your public landing beyond in-app profile. Build your audience, surface runs and
            plans, and earn from advertiser attention as people join what you publish.
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
            {ownerGwm?.creatorType === "coach" ? (
              <p className="text-xs text-gray-500 mt-2 max-w-md">
                MVP1: build audience and earn advertiser revenue here. Paid athlete subscriptions
                come later.
              </p>
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

      {!hasLandingCopy ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your public page is live, but landing copy is empty. Add a welcome and GoFastWithMe bio
          so visitors know how to join you.
        </div>
      ) : null}

      {publicSlug && gofastHandle ? (
        <GoFastWithMeUrlEditor
          gofastHandle={gofastHandle}
          publicSlug={publicSlug}
          slugUsesHandle={slugUsesHandle}
          publicUrl={liveUrl}
          onUpdated={(slug, usesHandle) => {
            setPublicSlug(slug);
            setSlugUsesHandle(usesHandle);
            void refreshPublicPreview(slug);
          }}
        />
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-900">What others can join</h2>
        <p className="text-sm text-gray-600 mt-1">
          These hydrate automatically when you host runs, publish plans, or turn on your community.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {AUTO_MODULES.map((label) => (
            <li
              key={label}
              className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700"
            >
              {label}
            </li>
          ))}
          <li className="inline-flex rounded-full border border-dashed border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500">
            Tips & nutrition (coming)
          </li>
        </ul>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 space-y-6 lg:w-96">
          <GoFastWithMeLandingForm
            initial={landingValues}
            profileBio={profileBio}
            onSaved={(values) => {
              setOwnerGwm((prev) => (prev ? { ...prev, ...values } : prev));
              setPayload((prev) =>
                prev ? { ...prev, gofastWithMe: { ...prev.gofastWithMe, ...values } } : prev
              );
              void refreshPublicPreview(publicSlug);
            }}
          />

          {athleteId ? (
            <div className="space-y-2">
              <PersonalCommunityCard
                athleteId={athleteId}
                gofastHandle={gofastHandle}
                initialEnabled={isGoFastContainer}
                compact
                onEnabledChange={(enabled) => {
                  setIsGoFastContainer(enabled);
                  setPayload((prev) => (prev ? { ...prev, isGoFastContainer: enabled } : prev));
                  void refreshPublicPreview(publicSlug);
                }}
              />
              <p className="text-xs text-gray-500 px-1">
                Turn on your athlete-scoped community so others can follow and join you.
              </p>
            </div>
          ) : null}

          {athleteId ? (
            <AdvertisingEarningsPanel
              athleteId={athleteId}
              isGoFastContainer={isGoFastContainer}
            />
          ) : null}

          <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900">Build joinable modules</h2>
            <p className="text-xs text-gray-600 mt-1">
              Publish a plan or host a run — they appear on your public page automatically.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                href="/training/lead"
                className="inline-flex justify-center rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Publish training plan
              </Link>
              <Link
                href="/host-a-run"
                className="inline-flex justify-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-50"
              >
                Host a public run
              </Link>
            </div>
          </section>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-600">In-app preview URL</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="text-xs text-gray-800 truncate flex-1">{appUrl}</code>
              <button
                type="button"
                onClick={() => void copyPublicUrl(`${window.location.origin}${appUrl}`)}
                className="text-xs font-medium text-orange-600"
              >
                {copyDone ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Visitor preview — {visitorHeadline}
          </p>
          <div className="rounded-xl border border-gray-200 shadow-lg max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden bg-zinc-950">
            <GoFastPagePreviewCard data={payload} />
          </div>
        </div>
      </div>
    </div>
  );
}
