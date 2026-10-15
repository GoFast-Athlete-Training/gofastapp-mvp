"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { GoFastWithMeCreatorType } from "@/lib/gofast-with-me/gofast-with-me-service";
import type { GoFastWithMeLandingValues } from "@/components/gofast-with-me/GoFastWithMeLandingForm";
import { normalizeGoFastWithMePhotoType } from "@/lib/gofast-with-me/photo-type";
import { goFastWithFrontDoorPath } from "@/lib/gofast-with-me/gofast-with-bridge";
import { athleteLinksPublicUrl } from "@/lib/content/athlete-links-public-url";
import GoFastWithMeHubOnboarding from "@/components/gofast-with-me/GoFastWithMeHubOnboarding";
import GoFastWithMeWelcomePanel from "@/components/gofast-with-me/GoFastWithMeWelcomePanel";
import GoFastWithMeRunnerStoryPanel from "@/components/gofast-with-me/GoFastWithMeRunnerStoryPanel";
import GoFastWithMeTrainingReflectionsPanel from "@/components/gofast-with-me/GoFastWithMeTrainingReflectionsPanel";
import GoFastWithMePayoutsPanel from "@/components/gofast-with-me/GoFastWithMePayoutsPanel";
import GoFastWithMeTipsPanel from "@/components/gofast-with-me/GoFastWithMeTipsPanel";
import GoFastWithMeRoutesPanel from "@/components/gofast-with-me/GoFastWithMeRoutesPanel";
import { AthleteLinkTreeEditor } from "@/components/profile/AthleteLinkTreeEditor";
import GoFastWithMeStudioAppShell from "@/components/gofast-with-me/GoFastWithMeStudioAppShell";
import GoFastWithMeStudioExplainer from "@/components/gofast-with-me/GoFastWithMeStudioExplainer";
import GoFastWithMeProgramGate from "@/components/gofast-with-me/GoFastWithMeProgramGate";
import TopNav from "@/components/shared/TopNav";
import {
  dismissStudioIntro,
  readStudioIntroDismissed,
  shouldShowStudioExplainer,
} from "@/lib/gofast-with-me/studio-intro";
import {
  markStudioReady,
  readStudioReady,
} from "@/lib/gofast-with-me/studio-ready";
import {
  isWelcomeContentComplete,
  type ContentEditorFocus,
  type StudioView,
} from "@/components/gofast-with-me/studio-sections";

type StudioPhase = "entry" | "content";

function viewFromSearchParam(raw: string | null): StudioView | null {
  if (!raw || raw === "payouts") return null;
  const allowed: StudioView[] = [
    "page",
    "runnerStory",
    "reflections",
    "content",
    "linkTree",
    "landingView",
    "communityHome",
  ];
  return allowed.includes(raw as StudioView) ? (raw as StudioView) : null;
}
import { runnerPublicLandingUrl } from "@/lib/gofast-with-me/runner-public-url";
import { athleteCommunityAppPath } from "@/lib/gofast-with-me/athlete-community-routes";

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
  runnerStory?: string | null;
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
  const searchParams = useSearchParams();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [gofastHandle, setGofastHandle] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [profileBio, setProfileBio] = useState<string | null>(null);
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [ownerGwm, setOwnerGwm] = useState<OwnerGwmRow | null>(null);
  const [publicSlug, setPublicSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateLoading, setGateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noHandle, setNoHandle] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [studioPhase, setStudioPhase] = useState<StudioPhase>("entry");
  const [activeView, setActiveView] = useState<StudioView>("page");
  const [contentFocus, setContentFocus] = useState<ContentEditorFocus | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [introDismissed, setIntroDismissed] = useState(() => readStudioIntroDismissed());
  const [studioReady, setStudioReady] = useState(() => readStudioReady());
  const [shareCopied, setShareCopied] = useState(false);

  const landingValues = ownerRowToLanding(ownerGwm);
  const isWelcomeComplete = isWelcomeContentComplete(landingValues);
  const showStudioExplainer = shouldShowStudioExplainer(ownerGwm, introDismissed);

  const handleViewChange = useCallback(
    (view: StudioView, options?: { contentFocus?: ContentEditorFocus }) => {
      setStudioPhase("content");
      setActiveView(view);
      if (view === "content") {
        setContentFocus(options?.contentFocus ?? "tip");
      } else {
        setContentFocus(null);
      }
      if (searchParams.get("view") === "payouts" && view !== "payouts") {
        router.replace("/gofast-with-others");
      }
    },
    [router, searchParams]
  );

  useEffect(() => {
    setIntroDismissed(readStudioIntroDismissed());
  }, []);

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'payouts') {
      setActiveView('payouts');
    }
  }, [searchParams]);

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
        const [profileRes, gwmRes, membersRes] = await Promise.all([
          api.get(`/athlete/${id}`),
          api.get("/me/gofast-with-me"),
          api.get(`/athlete/${id}/container/members`).catch(() => null),
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
        const gwm = gwmRes.data?.gofastWithMe as OwnerGwmRow | null;
        setOwnerGwm(gwm);
        const slug = gwm?.gofastSlugSnapshot ?? handle;
        setPublicSlug(slug);
        setShowOnboarding(!gwm?.creatorType);

        if (membersRes?.data?.success) {
          setFollowerCount(membersRes.data.count ?? 0);
        } else if (athlete?.isGoFastContainer) {
          setFollowerCount(0);
        }

        const landing = ownerRowToLanding(gwm);
        if (!cancelled) {
          const openPayouts = searchParams.get("view") === "payouts";
          const openContentStudio = searchParams.get("studio") === "content";
          const viewParam = viewFromSearchParam(searchParams.get("view"));
          if (openPayouts) {
            setActiveView("payouts");
          } else if (openContentStudio) {
            setStudioPhase("content");
            setActiveView(viewParam ?? (isWelcomeContentComplete(landing) ? "page" : "page"));
            if (viewParam === "content" || !viewParam) {
              const focus = searchParams.get("focus");
              if (focus === "route" || focus === "tip") {
                setContentFocus(focus);
              }
            }
          } else {
            setStudioPhase("entry");
            setActiveView("communityHome");
          }
          setLoading(false);
        }
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
  }, [router, searchParams]);

  const handleDismissStudioIntro = useCallback(() => {
    dismissStudioIntro();
    setIntroDismissed(true);
  }, []);

  const handleProgramReady = useCallback(() => {
    markStudioReady();
    setStudioReady(true);
    setError(null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopNav />
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      </div>
    );
  }

  if (activeView === 'payouts' && athleteId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopNav />
        <main className="flex-1 px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Link
              href="/gofast-with-others"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              ← Back to My Community
            </Link>
            <GoFastWithMePayoutsPanel />
          </div>
        </main>
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

  if (!studioReady) {
    return (
      <GoFastWithMeProgramGate
        loading={gateLoading}
        error={error}
        onReady={() => handleProgramReady()}
      />
    );
  }

  const shellSlug = publicSlug ?? gofastHandle;
  const shellLiveUrl = shellSlug ? runnerPublicLandingUrl(shellSlug) : '';
  const shellInvitePath = shellSlug ? goFastWithFrontDoorPath(shellSlug) : '';

  const copyInviteLink = async () => {
    if (!shellInvitePath) return;
    const inviteUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${shellInvitePath}`
        : shellInvitePath;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const communityHubUrl = shellSlug ? athleteCommunityAppPath(shellSlug) : "/athlete-home";

  const studioShell = (content: React.ReactNode) => (
    <GoFastWithMeStudioAppShell
      phase={studioPhase}
      onEnterContent={() => {
        setStudioPhase("content");
        if (activeView === "communityHome" || activeView === "landingView") {
          setActiveView("page");
        }
        router.replace("/gofast-with-others?studio=content");
      }}
      onBackToDoors={() => {
        setStudioPhase("entry");
        setActiveView("communityHome");
        router.replace("/gofast-with-others");
      }}
      activeView={activeView}
      contentFocus={contentFocus}
      onViewChange={handleViewChange}
      landingNeedsAction={!isWelcomeComplete}
      chromeActions={
        shellSlug
          ? {
              landingUrl: shellLiveUrl,
              inviteUrl: shellInvitePath,
              communityHubUrl,
              onShare: () => void copyInviteLink(),
              shareLabel: shareCopied ? "Copied!" : "Share link",
              linkPageUrl: gofastHandle ? athleteLinksPublicUrl(gofastHandle) : undefined,
            }
          : undefined
      }
    >
      {studioPhase === "content" ? (
        <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">{content}</div>
      ) : (
        content
      )}
    </GoFastWithMeStudioAppShell>
  );

  if (showOnboarding) {
    return (
      <GoFastWithMeStudioAppShell
        phase="entry"
        suppressDoors
        onEnterContent={() => setStudioPhase("content")}
        onBackToDoors={() => setStudioPhase("entry")}
        activeView={activeView}
        contentFocus={contentFocus}
        onViewChange={handleViewChange}
        landingNeedsAction={!isWelcomeComplete}
        chromeActions={
          shellSlug
            ? {
                landingUrl: shellLiveUrl,
                inviteUrl: shellInvitePath,
                communityHubUrl,
                onShare: () => void copyInviteLink(),
                shareLabel: shareCopied ? "Copied!" : "Share link",
                linkPageUrl: gofastHandle ? athleteLinksPublicUrl(gofastHandle) : undefined,
              }
            : undefined
        }
      >
        <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
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
        </div>
      </GoFastWithMeStudioAppShell>
    );
  }

  if (!gofastHandle || !publicSlug || !athleteId) {
    return studioShell(
      <div className="max-w-lg space-y-4">
        <p className="text-gray-700">{error || "Dashboard unavailable."}</p>
      </div>
    );
  }

  const liveUrl = shellLiveUrl;

  const renderStudioContent = () => {
    if (activeView === "payouts") {
      return null;
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
            onOpenRunnerStory={() => handleViewChange("runnerStory")}
            runnerStoryPublicUrl={
              publicSlug
                ? `${runnerPublicLandingUrl(publicSlug).replace(/\/$/, "")}/story`
                : null
            }
          />
        );
      case "runnerStory":
        return (
          <GoFastWithMeRunnerStoryPanel
            publicSlug={publicSlug}
            initialRunnerStory={ownerGwm?.runnerStory ?? null}
            onSaved={(runnerStory) => {
              setOwnerGwm((prev) => (prev ? { ...prev, runnerStory } : prev));
            }}
          />
        );
      case "reflections":
        return <GoFastWithMeTrainingReflectionsPanel publicSlug={publicSlug} />;
      case "linkTree":
        return <AthleteLinkTreeEditor embeddedInStudio />;
      case "content":
        return contentFocus === 'route' ? (
          <GoFastWithMeRoutesPanel athleteId={athleteId} />
        ) : (
          <GoFastWithMeTipsPanel athleteId={athleteId} liveUrl={liveUrl} />
        );
      default:
        return null;
    }
  };

  if (studioPhase === "entry") {
    return studioShell(
      <div className="space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {showStudioExplainer ? (
          <GoFastWithMeStudioExplainer onDismiss={handleDismissStudioIntro} />
        ) : null}
        {followerCount != null ? (
          <p className="text-sm text-gray-600">
            {followerCount} follower{followerCount === 1 ? "" : "s"} on your hub.
          </p>
        ) : null}
      </div>
    );
  }

  return studioShell(
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {renderStudioContent()}
    </div>
  );
}
