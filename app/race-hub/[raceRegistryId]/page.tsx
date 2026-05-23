"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import TopNav from "@/components/shared/TopNav";
import RaceHubAnnouncementsSection from "@/components/races/RaceHubAnnouncementsSection";
import RaceHubChatterSection from "@/components/races/RaceHubChatterSection";
import {
  RaceHubAtAGlanceSection,
  RaceHubMyResultSection,
} from "@/components/races/RaceHubInfoSections";
import {
  RaceHubEventsSection,
  RaceHubShakeoutsSection,
} from "@/components/races/RaceHubEventsSections";
import RaceHubPeopleSection from "@/components/races/RaceHubPeopleSection";
import RaceHubMobileTabs from "@/components/races/RaceHubMobileTabs";
import {
  distanceSnapToChips,
  formatDistanceFallback,
  formatRaceStartTimeLabel,
  type AnnouncementRow,
  type HubGateResult,
  type MembershipRow,
  type MyRaceResultRow,
  type RaceEventRow,
  type RaceSummary,
  type ShakeoutRunRow,
} from "@/components/races/race-hub-types";
import {
  getPublicCoursePageUrl,
  getPublicRacePageUrl,
} from "@/lib/public-race-url";
import LogRaceResultSheet from "@/components/races/LogRaceResultSheet";
import { raceCalendarOnOrBeforeTodayUtc } from "@/lib/training/plan-utils";
import { Calendar, Copy, MapPin, Trophy } from "lucide-react";

function RaceHubPageInner() {
  const params = useParams();
  const router = useRouter();
  const raceRegistryId = params.raceRegistryId as string;

  const [race, setRace] = useState<RaceSummary | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [events, setEvents] = useState<RaceEventRow[]>([]);
  const [shakeouts, setShakeouts] = useState<ShakeoutRunRow[]>([]);
  const [myMembership, setMyMembership] = useState<MembershipRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinRedirecting, setJoinRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [postingAnnounce, setPostingAnnounce] = useState(false);
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [runnersExpanded, setRunnersExpanded] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [myRaceResult, setMyRaceResult] = useState<MyRaceResultRow | null>(null);
  const [hubGoalId, setHubGoalId] = useState<string | null>(null);
  const [hubSignupId, setHubSignupId] = useState<string | null>(null);
  const [logSheetOpen, setLogSheetOpen] = useState(false);

  const athleteId = LocalStorageAPI.getAthleteId();
  const isAdmin = myMembership?.role === "ADMIN";

  const loadHubData = useCallback(async (): Promise<HubGateResult> => {
    const id = raceRegistryId?.trim();
    if (!id) {
      setRace(null);
      return { canAccessHub: false, loadedRace: null };
    }

    const me = LocalStorageAPI.getAthleteId();
    let loadedRace: RaceSummary | null = null;

    try {
      const raceRes = await api.get(`/race-registry/${encodeURIComponent(id)}`);
      if (raceRes.data?.race) {
        loadedRace = raceRes.data.race as RaceSummary;
        setRace(loadedRace);
      } else {
        setRace(null);
      }
    } catch {
      setRace(null);
      setError("error");
      return { canAccessHub: false, loadedRace: null };
    }

    try {
      const membersRes = await api.get(`/race-hub/${encodeURIComponent(id)}/members`);
      const list = (membersRes.data?.memberships || []) as MembershipRow[];
      setMemberships(list);
      const mine = me ? list.find((m) => m.athleteId === me) || null : null;
      setMyMembership(mine);

      if (!mine) {
        setAnnouncements([]);
        setEvents([]);
        setShakeouts([]);
        setMyRaceResult(null);
        setHubGoalId(null);
        setHubSignupId(null);
        return { canAccessHub: false, loadedRace };
      }

      const signupsRes = await api.get("/race-signups");
      const signups =
        (signupsRes.data?.signups as { id: string; raceRegistryId: string }[] | undefined) ?? [];
      const signupRow = signups.find((s) => s.raceRegistryId === id);
      const hasSignup = Boolean(signupRow);
      setHubSignupId(signupRow?.id ?? null);

      const memberIsAdmin = mine.role === "ADMIN";
      const canAccessHub = memberIsAdmin || hasSignup;

      if (!canAccessHub) {
        setAnnouncements([]);
        setEvents([]);
        setShakeouts([]);
        setMyRaceResult(null);
        setHubGoalId(null);
        return { canAccessHub: false, loadedRace };
      }

      const [aRes, eRes, shRes, rrRes, goalsRes] = await Promise.all([
        api.get(`/race-hub/${encodeURIComponent(id)}/announcements`),
        api.get(`/race-hub/${encodeURIComponent(id)}/events`),
        api.get(`/race-hub/${encodeURIComponent(id)}/shakeouts`),
        api
          .get("/race-results", { params: { raceRegistryId: id } })
          .catch(() => ({ data: { results: [] as unknown[] } })),
        api.get("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] } })),
      ]);
      setAnnouncements((aRes.data?.announcements as AnnouncementRow[]) || []);
      setEvents((eRes.data?.events as RaceEventRow[]) || []);
      setShakeouts((shRes.data?.shakeouts as ShakeoutRunRow[]) || []);
      const results = rrRes.data?.results;
      if (Array.isArray(results) && results[0] && typeof results[0].id === "string") {
        const r = results[0] as MyRaceResultRow;
        setMyRaceResult({
          id: r.id,
          officialFinishTime: r.officialFinishTime ?? null,
          source: typeof r.source === "string" ? r.source : "manual",
          actualAvgPaceSecPerMile: r.actualAvgPaceSecPerMile ?? null,
          overallPlace: r.overallPlace ?? null,
          ageGroupPlace: r.ageGroupPlace ?? null,
        });
      } else {
        setMyRaceResult(null);
      }
      const goals =
        (goalsRes.data?.goals as
          | {
              id: string;
              name?: string | null;
              goalTime?: string | null;
              raceRegistryId?: string | null;
              race_registry?: { id: string; name?: string | null };
            }[]
          | undefined) ?? [];
      const goalMatch = goals.find(
        (g) => g.raceRegistryId === id || g.race_registry?.id === id
      );
      setHubGoalId(goalMatch?.id ?? null);

      return { canAccessHub: true, loadedRace };
    } catch (e: unknown) {
      if (isAxiosError(e) && (e.response?.status === 403 || e.response?.status === 401)) {
        setMemberships([]);
        setMyMembership(null);
        setAnnouncements([]);
        setEvents([]);
        setShakeouts([]);
        setMyRaceResult(null);
        setHubGoalId(null);
        setHubSignupId(null);
        return { canAccessHub: false, loadedRace };
      }
      throw e;
    }
  }, [raceRegistryId]);

  useEffect(() => {
    if (!raceRegistryId?.trim()) {
      setError("Missing race id");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      if (!user || !LocalStorageAPI.getAthleteId()) {
        setLoading(false);
        setError("unauthorized");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const gate = await loadHubData();
        if (cancelled) return;

        if (!gate.canAccessHub) {
          const slug = gate.loadedRace?.slug?.trim();
          if (slug) {
            setJoinRedirecting(true);
            router.replace(`/join/race/${encodeURIComponent(slug)}`);
            return;
          }
          setError("no_join_path");
          return;
        }
      } catch (e: unknown) {
        console.error("Race hub load:", e);
        setError("error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [raceRegistryId, router, loadHubData]);

  useEffect(() => {
    if (loading || joinRedirecting || !race?.raceDate || !hubSignupId) return;
    if (!raceCalendarOnOrBeforeTodayUtc(race.raceDate)) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#log-result") return;
    window.requestAnimationFrame(() => {
      document.getElementById("log-result")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [loading, joinRedirecting, race?.raceDate, hubSignupId]);

  const postAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceRegistryId || !announceTitle.trim() || !announceBody.trim()) return;
    setPostingAnnounce(true);
    try {
      await api.post(`/race-hub/${encodeURIComponent(raceRegistryId.trim())}/announcements`, {
        title: announceTitle.trim(),
        content: announceBody.trim(),
      });
      setAnnounceTitle("");
      setAnnounceBody("");
      setShowAnnounceForm(false);
      const aRes = await api.get(`/race-hub/${encodeURIComponent(raceRegistryId.trim())}/announcements`);
      setAnnouncements((aRes.data?.announcements as AnnouncementRow[]) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setPostingAnnounce(false);
    }
  };

  const setRsvp = async (eventId: string, status: "going" | "not-going" | "maybe") => {
    if (!raceRegistryId) return;
    try {
      await api.post(
        `/race-hub/${encodeURIComponent(raceRegistryId.trim())}/events/${encodeURIComponent(eventId)}/rsvp`,
        { status }
      );
      const eRes = await api.get(`/race-hub/${encodeURIComponent(raceRegistryId.trim())}/events`);
      setEvents((eRes.data?.events as RaceEventRow[]) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const setShakeoutRunRsvp = async (runId: string, status: "going" | "not-going") => {
    const id = raceRegistryId?.trim();
    if (!id) return;
    try {
      await api.post(`/runs/${encodeURIComponent(runId)}/rsvp`, { status });
      const sRes = await api.get(`/race-hub/${encodeURIComponent(id)}/shakeouts`);
      setShakeouts((sRes.data?.shakeouts as ShakeoutRunRow[]) || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || joinRedirecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">{joinRedirecting ? "Redirecting to join…" : "Loading…"}</p>
        </div>
      </div>
    );
  }

  if (error === "unauthorized") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign in required</h2>
          <p className="text-gray-600 mb-4">Open the GoFast app and sign in to join this race hub.</p>
          <Link href="/signup" className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (error === "no_join_path") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Add this race from GoFast</h2>
          <p className="text-gray-600 mb-4">
            The race hub is for runners who added this event to their GoFast calendar. Find the race in the
            catalog and add it to My Races.
          </p>
          <Link href="/races/find" className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg">
            Find a race
          </Link>
        </div>
      </div>
    );
  }

  if (error === "error" || !race) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Race not found</h2>
          <Link href="/races" className="text-orange-600 font-medium hover:underline">
            ← My Races
          </Link>
        </div>
      </div>
    );
  }

  const locationText = [race.city, race.state].filter(Boolean).join(", ") || null;
  const distanceChips = distanceSnapToChips(race.distanceLabel);
  const distanceFallback =
    distanceChips.length > 0 ? null : formatDistanceFallback(race.distanceMeters);
  const raceStartLabel = formatRaceStartTimeLabel(race.startTime);
  const publicRaceUrl = getPublicRacePageUrl(race.slug);
  const courseTipsUrl = getPublicCoursePageUrl(race.courseSlug);
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
    hubSignupId && myMembership && race.raceDate && raceCalendarOnOrBeforeTodayUtc(race.raceDate)
  );

  const hubBackUrl = race.slug?.trim()
    ? `/myrace/${encodeURIComponent(race.slug.trim())}`
    : "/races";

  const copyInviteLink = async () => {
    const s = race.slug?.trim();
    if (!s || typeof window === "undefined") return;
    const url = `${window.location.origin}/join/race/${encodeURIComponent(s)}`;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch (e) {
      console.error("Copy invite link:", e);
    }
  };

  const cancelAnnounceForm = () => {
    setShowAnnounceForm(false);
    setAnnounceTitle("");
    setAnnounceBody("");
  };

  const sharedSectionProps = {
    raceRegistryId,
    announcements,
    isAdmin,
    showAnnounceForm,
    onToggleAnnounceForm: () => setShowAnnounceForm((v) => !v),
    announceTitle,
    announceBody,
    onAnnounceTitleChange: setAnnounceTitle,
    onAnnounceBodyChange: setAnnounceBody,
    onCancelAnnounceForm: cancelAnnounceForm,
    onPostAnnouncement: postAnnouncement,
    postingAnnounce,
    dateLabel,
    raceStartLabel,
    locationText,
    distanceChips,
    distanceFallback,
    publicRaceUrl,
    courseTipsUrl,
    shakeouts,
    events,
    memberships,
    currentUserId: athleteId ?? undefined,
    onSetShakeoutRunRsvp: setShakeoutRunRsvp,
    onSetRsvp: setRsvp,
    showPostRaceResultCard,
    myRaceResult,
    onOpenLogSheet: () => setLogSheetOpen(true),
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav showBack backUrl={hubBackUrl} backLabel="My race" />
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              {race.logoUrl?.trim() &&
              (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
                <img
                  src={race.logoUrl}
                  alt=""
                  className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl object-contain bg-white border-2 border-gray-200 flex-shrink-0 p-1"
                />
              ) : (
                <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl sm:text-2xl border-2 border-gray-200 flex-shrink-0">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  {race.name}
                </h1>
                <div className="mt-1 sm:mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-600 items-center">
                  {dateLabel ? (
                    <span className="flex items-center gap-1 min-w-0">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                      <span className="truncate">
                        {dateLabel}
                        {raceStartLabel ? ` · ${raceStartLabel}` : ""}
                      </span>
                    </span>
                  ) : null}
                  {locationText ? (
                    <span className="hidden sm:flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {locationText}
                    </span>
                  ) : null}
                  <span className="sm:hidden text-gray-500 truncate">
                    {[locationText, distanceChips[0] ?? distanceFallback].filter(Boolean).join(" · ")}
                  </span>
                  <span className="hidden sm:flex flex-wrap gap-2 items-center">
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
                  </span>
                </div>
              </div>
            </div>
            {myMembership && race.slug?.trim() ? (
              <button
                type="button"
                onClick={() => void copyInviteLink()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-2.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 transition-colors"
                aria-label={inviteCopied ? "Invite link copied" : "Copy invite link"}
              >
                <Copy className="w-4 h-4 text-orange-600" />
                <span className="hidden sm:inline">{inviteCopied ? "Copied!" : "Copy invite link"}</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
        <RaceHubMobileTabs {...sharedSectionProps} />

        <div className="hidden lg:grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
          <div className="lg:col-span-6 space-y-6 min-w-0 order-1">
            <RaceHubChatterSection raceRegistryId={raceRegistryId} />
            <RaceHubAnnouncementsSection
              announcements={announcements}
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
          </div>

          <aside className="lg:col-span-6 space-y-6 min-w-0 order-2">
            <RaceHubAtAGlanceSection
              dateLabel={dateLabel}
              raceStartLabel={raceStartLabel}
              locationText={locationText}
              distanceChips={distanceChips}
              distanceFallback={distanceFallback}
              publicRaceUrl={publicRaceUrl}
              courseTipsUrl={courseTipsUrl}
            />
            {showPostRaceResultCard ? (
              <RaceHubMyResultSection
                myRaceResult={myRaceResult}
                onOpenLogSheet={() => setLogSheetOpen(true)}
              />
            ) : null}
            <RaceHubShakeoutsSection
              shakeouts={shakeouts}
              onSetShakeoutRunRsvp={setShakeoutRunRsvp}
            />
            <RaceHubEventsSection events={events} onSetRsvp={setRsvp} />
            <RaceHubPeopleSection
              memberships={memberships}
              runnersExpanded={runnersExpanded}
              onToggleRunnersExpanded={() => setRunnersExpanded((v) => !v)}
              currentUserId={athleteId ?? undefined}
            />
          </aside>
        </div>
      </main>

      {myMembership && race && raceDateYmdForSheet && showPostRaceResultCard ? (
        <LogRaceResultSheet
          open={logSheetOpen}
          onClose={() => setLogSheetOpen(false)}
          raceRegistryId={race.id}
          raceName={race.name}
          raceDateYmd={raceDateYmdForSheet}
          goalId={hubGoalId}
          signupId={hubSignupId}
          onSaved={() => void loadHubData()}
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
