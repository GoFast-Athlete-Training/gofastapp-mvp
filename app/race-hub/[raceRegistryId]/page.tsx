"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import TopNav from "@/components/shared/TopNav";
import RaceHubAnnouncementsSection from "@/components/races/RaceHubAnnouncementsSection";
import RaceHubChatterSection from "@/components/races/RaceHubChatterSection";
import RaceHubCompactDetailsCard from "@/components/races/RaceHubCompactDetailsCard";
import RaceHubDoorNav from "@/components/races/RaceHubDoorNav";
import { RaceHubMyResultSection } from "@/components/races/RaceHubInfoSections";
import {
  RaceHubEventsSection,
  RaceHubShakeoutsSection,
} from "@/components/races/RaceHubEventsSections";
import RaceHubPeopleSection from "@/components/races/RaceHubPeopleSection";
import { useRaceHubPageLoad } from "@/components/races/useRaceHubPageLoad";
import type { RaceEventRow, RaceSummary, ShakeoutRunRow } from "@/components/races/race-hub-types";
import {
  distanceSnapToChips,
  formatDistanceFallback,
  formatRaceStartTimeLabel,
} from "@/components/races/race-hub-types";
import { buildRaceHubDoorLinks } from "@/lib/race-hub/build-hub-door-links";
import { hubWelcomeFromRegistry } from "@/lib/race-hub/hub-welcome-from-registry";
import LogRaceResultSheet from "@/components/races/LogRaceResultSheet";
import { raceCalendarOnOrBeforeTodayUtc } from "@/lib/training/plan-utils";
import { isRaceRegistryUuid, raceHubPath } from "@/lib/race-hub-urls";
import { app, auth } from "@/lib/firebase";
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
  const [runnersExpanded, setRunnersExpanded] = useState(false);
  const [isGuestForRsvp, setIsGuestForRsvp] = useState(true);

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

  useEffect(() => {
    try {
      const authInstance = getAuth(app);
      const unsub = onAuthStateChanged(authInstance, (user) => setIsGuestForRsvp(!user));
      return () => unsub();
    } catch {
      setIsGuestForRsvp(true);
      return undefined;
    }
  }, []);

  const signInToWrite = () => {
    const slug = raceSlug || routeParam;
    const returnPath = raceHubPath(slug);
    router.push(`/signup?redirect=${encodeURIComponent(returnPath)}`);
  };

  const signInToRsvp = useCallback(() => {
    const slug = raceSlug || routeParam;
    router.push(`/signup?redirect=${encodeURIComponent(raceHubPath(slug))}`);
  }, [raceSlug, routeParam, router]);

  const setShakeoutRunRsvp = async (runId: string, status: "going" | "not-going") => {
    if (hub.staffPreview) return;
    if (isGuestForRsvp || !auth.currentUser) {
      signInToRsvp();
      return;
    }
    const id = resolvedRegistryId?.trim();
    if (!id) return;
    try {
      await api.post(`/runs/${encodeURIComponent(runId)}/rsvp`, { status });
      const sRes = await api.get(`/race-hub/${encodeURIComponent(id)}/shakeouts`);
      hub.setShakeouts((sRes.data?.shakeouts as ShakeoutRunRow[]) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const setRsvp = async (eventId: string, status: "going" | "not-going" | "maybe") => {
    if (hub.staffPreview) return;
    if (isGuestForRsvp || !auth.currentUser) {
      signInToRsvp();
      return;
    }
    const id = resolvedRegistryId?.trim();
    if (!id) return;
    try {
      await api.post(
        `/race-hub/${encodeURIComponent(id)}/events/${encodeURIComponent(eventId)}/rsvp`,
        { status },
      );
      const eRes = await api.get(`/race-hub/${encodeURIComponent(id)}/events`);
      hub.setEvents((eRes.data?.events as RaceEventRow[]) || []);
    } catch (err) {
      console.error(err);
    }
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

  const prepDoorLinks = useMemo(
    () => doorLinks.filter((link) => link.external),
    [doorLinks],
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

  const welcome = hubWelcomeFromRegistry(hub.race ?? resolvedRace ?? {});

  const announcementsBlock = (
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
  );

  const mobileAnnouncementsStrip = (
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
      stripOnly
    />
  );

  const mobileDateLabel = race.raceDate
    ? new Date(race.raceDate).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const mobileHeaderMeta = [
    mobileDateLabel,
    raceStartLabel,
    locationText,
    distanceChips[0] ?? distanceFallback,
  ]
    .filter(Boolean)
    .join(" · ");

  const resultBlock = showPostRaceResultCard ? (
    <div id="log-result">
      <RaceHubMyResultSection
        myRaceResult={hub.myRaceResult}
        onOpenLogSheet={() => setLogSheetOpen(true)}
      />
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50 overflow-x-hidden lg:bg-gray-50">
      <TopNav showBack backUrl={hubBackUrl} backLabel="My race" />
      {hub.staffPreview ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
          Staff preview — read-only. Athletes still join through the hub when they post or RSVP.
        </div>
      ) : null}

      {/* Desktop header */}
      <header className="hidden lg:block bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-start gap-4 min-w-0">
            {race.logoUrl?.trim() &&
            (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
              <img
                src={race.logoUrl}
                alt=""
                className="w-16 h-16 rounded-xl object-contain bg-white border-2 border-gray-200 flex-shrink-0 p-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border-2 border-gray-200 flex-shrink-0">
                <Trophy className="w-8 h-8" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{race.name}</h1>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600 items-center">
                {dateLabel ? (
                  <span className="flex items-center gap-1 min-w-0">
                    <Calendar className="w-4 h-4 shrink-0" aria-hidden />
                    <span>
                      {dateLabel}
                      {raceStartLabel ? ` · ${raceStartLabel}` : ""}
                    </span>
                  </span>
                ) : null}
                {locationText ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 shrink-0" aria-hidden />
                    {locationText}
                  </span>
                ) : null}
                {distanceChips.map((label, idx) => (
                  <span
                    key={`${label}-${idx}`}
                    className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                  >
                    {label}
                  </span>
                ))}
                {distanceChips.length === 0 && distanceFallback ? (
                  <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                    {distanceFallback}
                  </span>
                ) : null}
              </div>
              {welcome ? (
                <p className="mt-3 text-sm leading-relaxed text-gray-700 max-w-3xl">{welcome}</p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slice */}
      <div className="lg:hidden mx-auto w-full max-w-md px-4 py-4 sm:py-6 space-y-4">
        <header className="text-center">
          {race.logoUrl?.trim() &&
          (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
            <div className="mx-auto mb-2 inline-flex rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-gray-200">
              <img src={race.logoUrl} alt="" className="h-14 w-14 object-contain" />
            </div>
          ) : (
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
              <Trophy className="h-7 w-7 text-orange-500" aria-hidden />
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{race.name}</h1>
          {mobileHeaderMeta ? (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-600 px-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{mobileHeaderMeta}</span>
            </p>
          ) : null}
        </header>

        {welcome ? (
          <section className="rounded-xl border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-800 shadow-sm line-clamp-4">
            {welcome}
          </section>
        ) : null}

        <RaceHubCompactDetailsCard links={doorLinks} memberships={hub.memberships} />

        {resultBlock}

        {mobileAnnouncementsStrip}

        <RaceHubChatterSection
          raceRegistryId={resolvedRegistryId ?? ""}
          readOnly={hub.staffPreview}
          onSignInToWrite={hub.isGuestSession ? signInToWrite : undefined}
          messageListClassName="min-h-[min(14rem,38vh)] max-h-[min(32rem,62vh)]"
        />
      </div>

      {/* Desktop web hub */}
      <main className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7 space-y-6 min-w-0">
            <RaceHubChatterSection
              raceRegistryId={resolvedRegistryId ?? ""}
              readOnly={hub.staffPreview}
              onSignInToWrite={hub.isGuestSession ? signInToWrite : undefined}
            />
            {announcementsBlock}
          </div>

          <aside className="lg:col-span-5 space-y-6 min-w-0">
            {prepDoorLinks.length > 0 ? <RaceHubDoorNav links={prepDoorLinks} /> : null}
            {resultBlock}
            <RaceHubShakeoutsSection
              shakeouts={hub.shakeouts}
              onSetShakeoutRunRsvp={setShakeoutRunRsvp}
              readOnly={hub.staffPreview}
            />
            <RaceHubEventsSection
              events={hub.events}
              onSetRsvp={setRsvp}
              readOnly={hub.staffPreview}
            />
            <RaceHubPeopleSection
              memberships={hub.memberships}
              runnersExpanded={runnersExpanded}
              onToggleRunnersExpanded={() => setRunnersExpanded((v) => !v)}
              currentUserId={athleteId ?? undefined}
            />
          </aside>
        </div>
      </main>

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
