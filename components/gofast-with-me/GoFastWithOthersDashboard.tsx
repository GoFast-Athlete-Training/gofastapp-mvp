"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { GoFastWithMeCreatorType } from "@/lib/gofast-with-me/gofast-with-me-service";
import type { GoFastWithMeLandingValues } from "@/components/gofast-with-me/GoFastWithMeLandingForm";
import { normalizeGoFastWithMePhotoType } from "@/lib/gofast-with-me/photo-type";
import { runnerPublicSegmentUrl } from "@/lib/gofast-with-me/runner-public-url";
import { athleteLinksPublicUrl } from "@/lib/content/athlete-links-public-url";
import GoFastWithMeWelcomePanel from "@/components/gofast-with-me/GoFastWithMeWelcomePanel";
import GoFastWithMeRunnerStoryPanel from "@/components/gofast-with-me/GoFastWithMeRunnerStoryPanel";
import GoFastWithMeTrainingReflectionsPanel from "@/components/gofast-with-me/GoFastWithMeTrainingReflectionsPanel";
import GoFastWithMePayoutsPanel from "@/components/gofast-with-me/GoFastWithMePayoutsPanel";
import GoFastWithMeTipsPanel from "@/components/gofast-with-me/GoFastWithMeTipsPanel";
import GoFastWithMeRoutesPanel from "@/components/gofast-with-me/GoFastWithMeRoutesPanel";
import GoFastWithMeBuildContentHub from "@/components/gofast-with-me/GoFastWithMeBuildContentHub";
import GoFastWithMeStudioAppShell from "@/components/gofast-with-me/GoFastWithMeStudioAppShell";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import {
  COMMUNITY_HUB_PATH,
  contentBuilderPayoutsPath,
  studioContentPath,
} from "@/lib/athlete/community-nav";
import {
  type ContentEditorFocus,
  type StudioSection,
  type StudioView,
} from "@/components/gofast-with-me/studio-sections";
import { runnerPublicLandingUrl } from "@/lib/gofast-with-me/runner-public-url";
import { athleteCommunityAppPath } from "@/lib/gofast-with-me/athlete-community-routes";

function viewFromSearchParam(raw: string | null): StudioSection | null {
  if (!raw || raw === "payouts") return null;
  const allowed: StudioSection[] = [
    "page",
    "runnerStory",
    "reflections",
    "content",
  ];
  return allowed.includes(raw as StudioSection) ? (raw as StudioSection) : null;
}

function isContentEditorFromParams(
  params: Pick<URLSearchParams, "get">,
): boolean {
  if (params.get("studio") !== "content") return false;
  return viewFromSearchParam(params.get("view")) !== null;
}

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
  runnerStoryTitle?: string | null;
  runnerStoryPhotoUrl?: string | null;
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
  const [profileBio, setProfileBio] = useState<string | null>(null);
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [ownerGwm, setOwnerGwm] = useState<OwnerGwmRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noHandle, setNoHandle] = useState(false);
  const [activeView, setActiveView] = useState<StudioView>("page");
  const [contentFocus, setContentFocus] = useState<ContentEditorFocus | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const landingValues = ownerRowToLanding(ownerGwm);
  const publicSlug = gofastHandle;

  const handleViewChange = useCallback(
    (view: StudioView, options?: { contentFocus?: ContentEditorFocus }) => {
      if (view === "payouts") {
        setActiveView("payouts");
        router.replace(contentBuilderPayoutsPath());
        return;
      }
      const section = view as StudioSection;
      setActiveView(section);
      if (section === "content") {
        setContentFocus(options?.contentFocus ?? "tip");
      } else {
        setContentFocus(null);
      }
      router.replace(studioContentPath(section, options?.contentFocus));
    },
    [router]
  );

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "payouts") {
      setActiveView("payouts");
      return;
    }
    if (!isContentEditorFromParams(searchParams)) {
      return;
    }
    const section = viewFromSearchParam(view)!;
    setActiveView(section);
    if (section === "content") {
      const focus = searchParams.get("focus");
      if (focus === "route" || focus === "tip") {
        setContentFocus(focus);
      } else {
        setContentFocus("tip");
      }
    } else {
      setContentFocus(null);
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
        setProfileBio(athlete?.bio ?? null);
        setProfilePhotoURL(athlete?.photoURL ?? null);
        const gwm = gwmRes.data?.gofastWithMe as OwnerGwmRow | null;
        setOwnerGwm(gwm);

        if (membersRes?.data?.success) {
          setFollowerCount(membersRes.data.count ?? 0);
        }

        if (!cancelled) {
          if (searchParams.get("view") === "linkTree") {
            router.replace("/links");
            return;
          }
          if (searchParams.get("view") === "payouts") {
            setActiveView("payouts");
          } else if (isContentEditorFromParams(searchParams)) {
            const view = viewFromSearchParam(searchParams.get("view"))!;
            setActiveView(view);
            if (view === "content") {
              const focus = searchParams.get("focus");
              if (focus === "route" || focus === "tip") {
                setContentFocus(focus);
              } else {
                setContentFocus("tip");
              }
            } else {
              setContentFocus(null);
            }
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong loading your content.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  if (loading) {
    return (
      <AthleteAppShell>
        <div className="flex flex-1 items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      </AthleteAppShell>
    );
  }

  if (activeView === "payouts" && athleteId) {
    return (
      <AthleteAppShell>
        <main className="px-4 sm:px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Link
              href={COMMUNITY_HUB_PATH}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              ← Manage Community
            </Link>
            <GoFastWithMePayoutsPanel />
          </div>
        </main>
      </AthleteAppShell>
    );
  }

  if (noHandle) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-lg mx-auto px-4 py-10 space-y-4">
          <p className="text-gray-700 text-sm">
            Set your GoFast handle first — your public pages live at that URL.
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

  const shellSlug = publicSlug ?? gofastHandle;
  const shellLiveUrl = shellSlug ? runnerPublicLandingUrl(shellSlug) : "";

  const copyLandingLink = async () => {
    if (!shellLiveUrl) return;
    try {
      await navigator.clipboard.writeText(shellLiveUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const communityHubUrl = shellSlug ? athleteCommunityAppPath(shellSlug) : "/athlete-home";

  const inContentEditor = isContentEditorFromParams(searchParams);
  const editorSection =
    activeView === "payouts" ? "page" : (activeView as StudioSection);

  const studioShell = (content: React.ReactNode) => (
    <AthleteAppShell>
      <GoFastWithMeStudioAppShell
        editorSection={editorSection}
        editorFocus={
          editorSection === "content"
            ? contentFocus === "route"
              ? "route"
              : "tip"
            : null
        }
        chromeActions={
          shellSlug
            ? {
                landingUrl: shellLiveUrl,
                communityHubUrl,
                onCopyLandingLink: () => void copyLandingLink(),
                copyLandingLabel: shareCopied ? "Copied!" : "Copy landing link",
                linkPageUrl: gofastHandle ? athleteLinksPublicUrl(gofastHandle) : undefined,
              }
            : undefined
        }
      >
        <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">{content}</div>
      </GoFastWithMeStudioAppShell>
    </AthleteAppShell>
  );

  if (!gofastHandle || !publicSlug || !athleteId) {
    return (
      <AthleteAppShell>
        <main className="px-4 sm:px-6 py-6 max-w-lg">
          <p className="text-gray-700">{error || "Dashboard unavailable."}</p>
        </main>
      </AthleteAppShell>
    );
  }

  const liveUrl = shellLiveUrl;

  if (!inContentEditor) {
    return (
      <AthleteAppShell>
        <main className="px-4 sm:px-6 py-6 max-w-6xl mx-auto space-y-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {followerCount != null ? (
            <p className="text-sm text-gray-600">
              {followerCount} follower{followerCount === 1 ? "" : "s"} — open{" "}
              <Link href={communityHubUrl} className="font-semibold text-sky-700 hover:underline">
                Manage Community
              </Link>
              .
            </p>
          ) : null}
          <GoFastWithMeBuildContentHub
            onOpen={(section, focus) =>
              handleViewChange(section, focus ? { contentFocus: focus } : undefined)
            }
          />
        </main>
      </AthleteAppShell>
    );
  }

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
                ? runnerPublicSegmentUrl(publicSlug, "story")
                : null
            }
          />
        );
      case "runnerStory":
        return (
          <GoFastWithMeRunnerStoryPanel
            publicSlug={publicSlug}
            initialRunnerStory={ownerGwm?.runnerStory ?? null}
            initialRunnerStoryTitle={ownerGwm?.runnerStoryTitle ?? null}
            initialRunnerStoryPhotoUrl={ownerGwm?.runnerStoryPhotoUrl ?? null}
            onSaved={(values) => {
              setOwnerGwm((prev) => (prev ? { ...prev, ...values } : prev));
            }}
          />
        );
      case "reflections":
        return <GoFastWithMeTrainingReflectionsPanel publicSlug={publicSlug} />;
      case "content":
        return contentFocus === "route" ? (
          <GoFastWithMeRoutesPanel athleteId={athleteId} />
        ) : (
          <GoFastWithMeTipsPanel athleteId={athleteId} liveUrl={liveUrl} />
        );
      default:
        return null;
    }
  };

  return studioShell(
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {followerCount != null ? (
        <p className="text-sm text-gray-600">
          {followerCount} follower{followerCount === 1 ? "" : "s"} — open{" "}
          <Link href={communityHubUrl} className="font-semibold text-sky-700 hover:underline">
            Manage Community
          </Link>
          .
        </p>
      ) : null}

      {renderStudioContent()}
    </div>
  );
}
