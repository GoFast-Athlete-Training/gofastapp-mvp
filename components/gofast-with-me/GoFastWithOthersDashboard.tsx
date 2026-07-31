"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { ShareHubStatus } from "@/lib/profile/share-creator-card-logic";
import type { GoFastWithMeCreatorType } from "@/lib/gofast-with-me/gofast-with-me-service";
import type { GoFastWithMeLandingValues } from "@/components/gofast-with-me/GoFastWithMeLandingForm";
import { normalizeGoFastWithMePhotoType } from "@/lib/gofast-with-me/photo-type";
import { goFastWithFrontDoorPath } from "@/lib/gofast-with-me/gofast-with-bridge";
import GoFastWithMeHubOnboarding from "@/components/gofast-with-me/GoFastWithMeHubOnboarding";
import GoFastWithMeWelcomePanel from "@/components/gofast-with-me/GoFastWithMeWelcomePanel";
import GoFastWithMeCommunityPanel from "@/components/gofast-with-me/GoFastWithMeCommunityPanel";
import GoFastWithMeWorkoutsPanel from "@/components/gofast-with-me/GoFastWithMeWorkoutsPanel";
import GoFastWithMeCmsContentSection from "@/components/gofast-with-me/GoFastWithMeContentPanel";
import GoFastWithMeDashboardHome, {
  type DashboardMetrics,
} from "@/components/gofast-with-me/GoFastWithMeDashboardHome";
import GoFastWithMeStudioAppShell from "@/components/gofast-with-me/GoFastWithMeStudioAppShell";
import GoFastWithMeStudioExplainer from "@/components/gofast-with-me/GoFastWithMeStudioExplainer";
import GoFastWithMeProgramGate from "@/components/gofast-with-me/GoFastWithMeProgramGate";
import {
  dismissStudioIntro,
  readStudioIntroDismissed,
  shouldShowStudioExplainer,
} from "@/lib/gofast-with-me/studio-intro";
import {
  isWelcomeContentComplete,
  type StudioSection,
  type StudioView,
} from "@/components/gofast-with-me/studio-sections";

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
  gofastWithMePhotoFocusX: number | null;
  gofastWithMePhotoFocusY: number | null;
  gofastWithMePhotoZoom: number | null;
  gofastWithMePhotoType: string | null;
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
    gofastWithMePhotoFocusX: row?.gofastWithMePhotoFocusX ?? null,
    gofastWithMePhotoFocusY: row?.gofastWithMePhotoFocusY ?? null,
    gofastWithMePhotoZoom: row?.gofastWithMePhotoZoom ?? null,
    gofastWithMePhotoType: normalizeGoFastWithMePhotoType(row?.gofastWithMePhotoType),
  };
}

export default function GoFastWithOthersDashboard() {
  const router = useRouter();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [gofastHandle, setGofastHandle] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState<string | null>(null);
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [ownerGwm, setOwnerGwm] = useState<OwnerGwmRow | null>(null);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [slugUsesHandle, setSlugUsesHandle] = useState(true);
  const [isGoFastContainer, setIsGoFastContainer] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateLoading, setGateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noHandle, setNoHandle] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeView, setActiveView] = useState<StudioView>("dashboard");
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [shareHubStatus, setShareHubStatus] = useState<ShareHubStatus | null>(null);
  const [introDismissed, setIntroDismissed] = useState(false);

  const landingValues = ownerRowToLanding(ownerGwm);
  const isWelcomeComplete = isWelcomeContentComplete(landingValues);
  const showStudioExplainer = shouldShowStudioExplainer(ownerGwm, introDismissed);

  const isPublishReady = Boolean(
    landingValues.welcome?.trim() ||
      landingValues.gofastWithMeBio?.trim() ||
      landingValues.whatYoullSeeHere?.trim()
  );

  const openWorkspace = useCallback((section: StudioSection) => {
    setActiveView(section);
  }, []);

  const refreshShareHubStatus = useCallback(async () => {
    try {
      const res = await api.get('/me/share-hub-status');
      if (res.data?.status) {
        setShareHubStatus(res.data.status as ShareHubStatus);
      }
    } catch {
      /* keep last known status */
    }
  }, []);

  useEffect(() => {
    setIntroDismissed(readStudioIntroDismissed());
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
        const [profileRes, gwmRes, membersRes, hubStatusRes] = await Promise.all([
          api.get(`/athlete/${id}`),
          api.get("/me/gofast-with-me"),
          api.get(`/athlete/${id}/container/members`).catch(() => null),
          api.get("/me/share-hub-status").catch(() => null),
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
        setProfilePhotoURL(athlete?.photoURL ?? null);
        setIsGoFastContainer(Boolean(athlete?.isGoFastContainer));

        const gwm = gwmRes.data?.gofastWithMe as OwnerGwmRow | null;
        setOwnerGwm(gwm);
        const slug = gwm?.gofastSlugSnapshot ?? handle;
        setPublicSlug(slug);
        setSlugUsesHandle(gwm?.slugUsesHandle ?? true);
        setShowOnboarding(!gwm?.creatorType);

        if (membersRes?.data?.success) {
          setFollowerCount(membersRes.data.count ?? 0);
        } else if (athlete?.isGoFastContainer) {
          setFollowerCount(0);
        }

        if (hubStatusRes?.data?.status) {
          setShareHubStatus(hubStatusRes.data.status as ShareHubStatus);
        }

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading GoFastWithMe Studio.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleDismissStudioIntro = useCallback(() => {
    dismissStudioIntro();
    setIntroDismissed(true);
  }, []);

  const handleProgramReady = useCallback(async () => {
    if (!athleteId || gateLoading) return;
    setGateLoading(true);
    setError(null);
    try {
      const res = await api.post(`/athlete/${athleteId}/container/toggle`, { value: true });
      if (res.data?.isGoFastContainer) {
        setIsGoFastContainer(true);
        setFollowerCount(0);
      } else {
        setError("Could not enable GoFast With Me. Try again.");
      }
    } catch {
      setError("Could not enable GoFast With Me. Try again.");
    } finally {
      setGateLoading(false);
    }
  }, [athleteId, gateLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (noHandle) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-lg mx-auto px-4 py-10 space-y-4">
          <p className="text-gray-700 text-sm">
            Set your GoFast handle first — then you can join the GoFast With Me program.
          </p>
          <Link
            href="/athlete-edit-profile?tab=profile-info"
            className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Go to Profile Info
          </Link>
        </div>
      </div>
    );
  }

  if (isGoFastContainer === false) {
    return (
      <GoFastWithMeProgramGate
        loading={gateLoading}
        error={error}
        onReady={() => void handleProgramReady()}
      />
    );
  }

  const studioShell = (content: React.ReactNode) => (
    <GoFastWithMeStudioAppShell
      activeView={activeView}
      onViewChange={setActiveView}
      pageNeedsAction={!isWelcomeComplete}
    >
      <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">{content}</div>
    </GoFastWithMeStudioAppShell>
  );

  if (showOnboarding) {
    return studioShell(
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
                  gofastWithMePhotoFocusX: null,
                  gofastWithMePhotoFocusY: null,
                  gofastWithMePhotoZoom: null,
                  gofastWithMePhotoType: null,
                  creatorType,
                  coachSpecialty,
                }
          );
          setShowOnboarding(false);
        }}
      />
    );
  }

  if (!gofastHandle || !publicSlug || !athleteId) {
    return studioShell(
      <div className="max-w-lg space-y-4">
        <p className="text-gray-700">{error || "Dashboard unavailable."}</p>
      </div>
    );
  }

  const liveUrl = `${RUNNER_BASE}/${publicSlug}`;
  const invitePath = goFastWithFrontDoorPath(publicSlug);
  const visitorHeadline = firstName ? `GoFast with ${firstName}` : "Your public page";
  const creatorLabel =
    ownerGwm?.creatorType === "coach"
      ? "Coach"
      : ownerGwm?.creatorType === "person"
        ? "Athlete"
        : null;

  const dashboardMetrics: DashboardMetrics = {
    followerCount,
    landingComplete: isWelcomeComplete,
    publishReady: isPublishReady,
    planPublished: shareHubStatus?.plan.isPublished ?? null,
    planName: shareHubStatus?.plan.planName ?? null,
    liveUrl,
    invitePath,
    publicSlug,
    gofastHandle,
    slugUsesHandle,
  };

  const renderStudioContent = () => {
    if (activeView === "dashboard") {
      return (
        <div className="space-y-6">
          {showStudioExplainer ? (
            <GoFastWithMeStudioExplainer onDismiss={handleDismissStudioIntro} />
          ) : null}

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

          <GoFastWithMeDashboardHome
            metrics={dashboardMetrics}
            visitorHeadline={visitorHeadline}
            onOpenWorkspace={openWorkspace}
            onUrlUpdated={(slug, usesHandle) => {
              setPublicSlug(slug);
              setSlugUsesHandle(usesHandle);
            }}
          />
        </div>
      );
    }

    switch (activeView) {
      case "page":
        return (
          <GoFastWithMeWelcomePanel
            landingValues={landingValues}
            profileBio={profileBio}
            profilePhotoURL={profilePhotoURL}
            athleteId={athleteId}
            liveUrl={liveUrl}
            onSaved={(values) => {
              setOwnerGwm((prev) => (prev ? { ...prev, ...values } : prev));
            }}
            onAvatarSaved={(photoURL) => setProfilePhotoURL(photoURL)}
          />
        );
      case "community":
        return (
          <GoFastWithMeCommunityPanel athleteId={athleteId} publicSlug={publicSlug} />
        );
      case "workouts":
        return (
          <GoFastWithMeWorkoutsPanel
            publicSlug={publicSlug}
            firstName={firstName}
            plan={shareHubStatus?.plan ?? null}
            planLoading={shareHubStatus == null}
            onRefreshPlanStatus={refreshShareHubStatus}
          />
        );
      case "content":
        return (
          <GoFastWithMeCmsContentSection
            liveUrl={liveUrl}
            onOpenWorkouts={() => openWorkspace("workouts")}
            onOpenCommunity={() => openWorkspace("community")}
          />
        );
      default:
        return null;
    }
  };

  return studioShell(
    <div className="space-y-6 pb-8">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {renderStudioContent()}
    </div>
  );
}
