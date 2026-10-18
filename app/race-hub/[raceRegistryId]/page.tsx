"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import RaceHubAnnouncementsSection from "@/components/races/RaceHubAnnouncementsSection";
import RaceHubChatterSection from "@/components/races/RaceHubChatterSection";
import RaceHubDoorNav from "@/components/races/RaceHubDoorNav";
import RaceHubSeeWhosHereSection from "@/components/races/RaceHubSeeWhosHereSection";
import { RaceHubMyResultSection } from "@/components/races/RaceHubInfoSections";
import { useRaceHubPageLoad } from "@/components/races/useRaceHubPageLoad";
import {
  distanceSnapToChips,
  formatDistanceFallback,
  formatRaceStartTimeLabel,
  type RaceSummary,
} from "@/components/races/race-hub-types";
import { buildRaceHubDoorLinks } from "@/lib/race-hub/build-hub-door-links";
import LogRaceResultSheet from "@/components/races/LogRaceResultSheet";
import { raceCalendarOnOrBeforeTodayUtc } from "@/lib/training/plan-utils";
import { isRaceRegistryUuid, raceHubPath } from "@/lib/race-hub-urls";
import { Calendar, MapPin, Trophy } from "lucide-react";
import api from "@/lib/api";

function RaceHubPageInner() {
  const params = useParams();
  const router = useRouter();
  const routeParam = (params.raceRegistryId as string)?.trim() || "";

  const [resolvedRegistryId, setResolvedRegistryId] = useState<string | null>(null);
  const [raceSlug, setRaceSlug] = useState<string | null>(null);
  const [resolvedRace, setResolvedRace] = useState<RaceSummary | null>(null);
  const [resolving, setResolving] = useState(true);
  const [resolveError, setResolveError] = useState(false);

  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [postingAnnounce, setPostingAnnounce] = useState(false);
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [logSheetOpen, setLogSheetOpen] = useState(false);

  const hub = useRaceHubPageLoad(resolvedRegistryId, resolving, resolvedRace);

  const athleteId = typeof window !== "undefined" ? hub.myMembership?.athleteId : undefined;
  const isAdmin = !hub.staffPreview && hub.myMembership?.role === "ADMIN";

  useEffect(() => {
    if (!routeParam) {
      setResolveError(true);
      setResolving(false);
      return;
    }

    let cancelled = false;

    async function resolveRouteParam() {
      try {
        setResolving(true);
        const res = await fetch(
          `/api/race-hub/public/resolve-by-slug/${encodeURIComponent(routeParam)}`,
        );
        if (!res.ok) {
          if (!cancelled) setResolveError(true);
          return;
        }
        const data = await res.json();
        const resolved = data.race as RaceSummary | undefined;
        if (!data.success || !resolved?.id) {
          if (!cancelled) setResolveError(true);
          return;
        }

        if (!cancelled) {
          setResolvedRegistryId(resolved.id);
          const slug = resolved.slug?.trim() || null;
          setRaceSlug(slug);
          setResolvedRace(resolved);
          if (slug && isRaceRegistryUuid(routeParam) && slug !== routeParam) {
            router.replace(raceHubPath(slug));
          }
        }
      } catch (e) {
        console.error("Race hub resolve:", e);
        if (!cancelled) setResolveError(true);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    void resolveRouteParam();
    return () => {
      cancelled = true;
    };
  }, [routeParam, router]);

  const signInToWrite = () => {
    const slug = raceSlug || routeParam;
    const returnPath = raceHubPath(slug);
    router.push(`/signup?redirect=${encodeURIComponent(returnPath)}`);
  };

  const postAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedRegistryId || !announceTitle.trim() || !announceBody.trim()) return;
    setPostingAnnounce(true);
    try {
      await api.post(`/race-hub/${encodeURIComponent(resolvedRegistryId)}/announcements`, {
        title: announceTitle.trim(),
        content: announceBody.trim(),
      });
      setAnnounceTitle("");
      setAnnounceBody("");
      setShowAnnounceForm(false);
      await hub.reloadHub();
    } catch (err) {
      console.error(err);
    } finally {
      setPostingAnnounce(false);
    }
  };

  const doorLinks = useMemo(
    () =>
      buildRaceHubDoorLinks({
        raceSlug: hub.race?.slug ?? raceSlug,
        courseSlug: hub.race?.courseSlug ?? null,
        shakeouts: hub.shakeouts,
      }),
    [hub.race?.slug, hub.race?.courseSlug, hub.shakeouts, raceSlug],
  );

  if (resolving || hub.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (resolveError || !hub.race) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Race not found</h2>
          <Link href="/races" className="text-orange-600 font-medium hover:underline">
            ← My Races
          </Link>
        </div>
      </div>
    );
  }

  const race = hub.race;
  const locationText = [race.city, race.state].filter(Boolean).join(", ") || null;
  const distanceChips = distanceSnapToChips(race.distanceLabel);
  const distanceFallback =
    distanceChips.length > 0 ? null : formatDistanceFallback(race.distanceMeters);
  const raceStartLabel = formatRaceStartTimeLabel(race.startTime);
  const dateLabel = race.raceDate
    ? new Date(race.raceDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const raceDateYmdForSheet = race.raceDate ? String(race.raceDate).slice(0, 10) : "";
  const showPostRaceResultCard = Boolean(
    hub.hubSignupId &&
      hub.myMembership &&
      race.raceDate &&
      raceCalendarOnOrBeforeTodayUtc(race.raceDate),
  );

  const hubBackUrl = race.slug?.trim()
    ? `/myrace/${encodeURIComponent(race.slug.trim())}`
    : "/races";

  const cancelAnnounceForm = () => {
    setShowAnnounceForm(false);
    setAnnounceTitle("");
    setAnnounceBody("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50 overflow-x-hidden">
      <TopNav showBack backUrl={hubBackUrl} backLabel="My race" />
      {hub.staffPreview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
          Staff preview — read-only. Athletes still join through the hub when they post or RSVP.
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-8 space-y-6">
        <header className="text-center">
          {race.logoUrl?.trim() &&
          (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
            <div className="mx-auto mb-4 inline-flex rounded-2xl bg-white p-2 shadow-sm ring-1 ring-gray-200">
              <img src={race.logoUrl} alt="" className="h-20 w-20 object-contain" />
            </div>
          ) : (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm ring-1 ring-gray-200">
              <Trophy className="h-10 w-10 text-orange-500" aria-hidden />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{race.name}</h1>
          {dateLabel ? (
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-gray-600">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden />
              {dateLabel}
              {raceStartLabel ? ` · ${raceStartLabel}` : ""}
            </p>
          ) : null}
          {locationText ? (
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-gray-600">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden />
              {locationText}
              {distanceChips[0] ?? distanceFallback ? ` · ${distanceChips[0] ?? distanceFallback}` : ""}
            </p>
          ) : null}
        </header>

        {hub.welcomeText?.trim() ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-800 shadow-sm sm:p-5">
            {hub.welcomeText.trim()}
          </section>
        ) : null}

        <RaceHubAnnouncementsSection
          announcements={hub.announcements}
          isAdmin={isAdmin}
          showAnnounceForm={showAnnounceForm}
          onToggleAnnounceForm={() => setShowAnnounceForm((v) => !v)}
          announceTitle={announceTitle}
          announceBody={announceBody}
          onAnnounceTitleChange={setAnnounceTitle}
          onAnnounceBodyChange={setAnnounceBody}
          onCancelAnnounceForm={cancelAnnounceForm}
          onPostAnnouncement={postAnnouncement}
          postingAnnounce={postingAnnounce}
        />

        <RaceHubDoorNav links={doorLinks} />

        <RaceHubSeeWhosHereSection memberships={hub.memberships} />

        {showPostRaceResultCard ? (
          <div id="log-result">
            <RaceHubMyResultSection
              myRaceResult={hub.myRaceResult}
              onOpenLogSheet={() => setLogSheetOpen(true)}
            />
          </div>
        ) : null}

        <RaceHubChatterSection
          raceRegistryId={resolvedRegistryId ?? ""}
          readOnly={hub.staffPreview}
          onSignInToWrite={hub.isGuestSession ? signInToWrite : undefined}
          messageListClassName="min-h-[min(14rem,35vh)] max-h-[min(28rem,55vh)]"
        />
      </div>

      {hub.myMembership && race && raceDateYmdForSheet && showPostRaceResultCard ? (
        <LogRaceResultSheet
          open={logSheetOpen}
          onClose={() => setLogSheetOpen(false)}
          raceRegistryId={race.id}
          raceName={race.name}
          raceDateYmd={raceDateYmdForSheet}
          goalId={hub.hubGoalId}
          signupId={hub.hubSignupId}
          onSaved={() => void hub.reloadHub()}
        />
      ) : null}
    </div>
  );
}

export default function RaceHubPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <RaceHubPageInner />
    </Suspense>
  );
}
