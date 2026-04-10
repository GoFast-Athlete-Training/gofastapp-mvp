"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { LocalStorageAPI } from "@/lib/localstorage";
import api from "@/lib/api";
import TopNav from "@/components/shared/TopNav";
import MemberDetailCard from "@/components/RunCrew/MemberDetailCard";
import AnnouncementCard from "@/components/RunCrew/AnnouncementCard";
import RaceMessageFeed from "@/components/races/RaceMessageFeed";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Info,
  MapPin,
  Package,
  Plus,
  Route,
  Trophy,
} from "lucide-react";

type RaceSummary = {
  id: string;
  name: string;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceMeters: number | null;
  logoUrl: string | null;
  distanceLabel: string | null;
  registrationUrl: string | null;
  description: string | null;
  courseMapUrl: string | null;
  resultsUrl: string | null;
  startTime: string | null;
  packetPickupLocation: string | null;
  packetPickupDate: string | null;
  packetPickupTime: string | null;
  packetPickupDescription: string | null;
  spectatorInfo: string | null;
  logisticsInfo: string | null;
  gearDropInstructions: string | null;
};

function distanceLabelBadge(label: string | null | undefined): string {
  if (!label?.trim()) return "Race";
  const t = label.trim();
  if (t.length <= 4 && !t.includes("_")) return t.toUpperCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function distanceSnapToChips(snap: string | null | undefined): string[] {
  if (!snap?.trim()) return [];
  return snap
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatRaceStartTimeLabel(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isHttpOrPathUrl(url: string | null | undefined): boolean {
  const u = url?.trim() ?? "";
  return u.startsWith("http") || u.startsWith("/");
}

type MembershipRow = {
  id: string;
  athleteId: string;
  role: string;
  joinedAt: string;
  Athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
    bio: string | null;
  };
};

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  Athlete: { firstName: string | null; lastName: string | null };
};

type RaceEventRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  address: string | null;
  description: string | null;
  race_event_rsvps?: { status: string }[];
};

function mapRaceRoleToCrewRole(
  role: string
): "member" | "manager" | "admin" {
  if (role === "ADMIN") return "admin";
  return "member";
}

function memberInitials(a: MembershipRow["Athlete"]): string {
  const f = a.firstName?.trim()?.[0] ?? "";
  const l = a.lastName?.trim()?.[0] ?? "";
  const h = a.gofastHandle?.trim();
  if (f && l) return `${f}${l}`.toUpperCase();
  if (f) return f.toUpperCase();
  if (h) return h.slice(0, 2).toUpperCase();
  return "?";
}

function RaceHubPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const raceRegistryId = params.raceRegistryId as string;

  const [race, setRace] = useState<RaceSummary | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [events, setEvents] = useState<RaceEventRow[]>([]);
  const [myMembership, setMyMembership] = useState<MembershipRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [postingAnnounce, setPostingAnnounce] = useState(false);
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [runnersExpanded, setRunnersExpanded] = useState(false);

  const athleteId = LocalStorageAPI.getAthleteId();
  const joinRequested = searchParams.get("join") === "1";
  const isAdmin = myMembership?.role === "ADMIN";

  const loadHubData = useCallback(async (): Promise<{ isMember: boolean }> => {
    const id = raceRegistryId?.trim();
    if (!id) {
      setRace(null);
      return { isMember: false };
    }

    const me = LocalStorageAPI.getAthleteId();

    try {
      const raceRes = await api.get(`/race-registry/${encodeURIComponent(id)}`);
      if (raceRes.data?.race) {
        setRace(raceRes.data.race as RaceSummary);
      } else {
        setRace(null);
      }
    } catch {
      setRace(null);
      setError("error");
      return { isMember: false };
    }

    try {
      const membersRes = await api.get(`/race-hub/${encodeURIComponent(id)}/members`);
      const list = (membersRes.data?.memberships || []) as MembershipRow[];
      setMemberships(list);
      const mine = me ? list.find((m) => m.athleteId === me) || null : null;
      setMyMembership(mine);

      if (mine) {
        const [aRes, eRes] = await Promise.all([
          api.get(`/race-hub/${encodeURIComponent(id)}/announcements`),
          api.get(`/race-hub/${encodeURIComponent(id)}/events`),
        ]);
        setAnnouncements((aRes.data?.announcements as AnnouncementRow[]) || []);
        setEvents((eRes.data?.events as RaceEventRow[]) || []);
      } else {
        setAnnouncements([]);
        setEvents([]);
      }
      return { isMember: Boolean(mine) };
    } catch (e: unknown) {
      if (isAxiosError(e) && (e.response?.status === 403 || e.response?.status === 401)) {
        setMemberships([]);
        setMyMembership(null);
        setAnnouncements([]);
        setEvents([]);
        return { isMember: false };
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
        let { isMember } = await loadHubData();
        if (cancelled) return;

        if (joinRequested && !isMember) {
          setJoinBusy(true);
          await api.post(`/race-hub/${encodeURIComponent(raceRegistryId.trim())}/join`);
          router.replace(`/race-hub/${encodeURIComponent(raceRegistryId.trim())}`);
          const again = await loadHubData();
          isMember = again.isMember;
        }
        if (!isMember) {
          setError(null);
        }
      } catch (e: unknown) {
        console.error("Race hub load:", e);
        setError("error");
      } finally {
        if (!cancelled) {
          setJoinBusy(false);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [raceRegistryId, joinRequested, router, loadHubData]);

  const handleJoin = async () => {
    if (!raceRegistryId) return;
    setJoinBusy(true);
    try {
      await api.post(`/race-hub/${encodeURIComponent(raceRegistryId.trim())}/join`);
      await loadHubData();
    } catch (e) {
      console.error(e);
    } finally {
      setJoinBusy(false);
    }
  };

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

  if (loading || joinBusy) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">{joinBusy ? "Joining race hub…" : "Loading…"}</p>
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
  const raceStartLabel = formatRaceStartTimeLabel(race.startTime);
  const mapEmbedUrl = `https://www.google.com/maps/embed?q=${encodeURIComponent(
    locationText || "Race location"
  )}`;
  const dateLabel = race.raceDate
    ? new Date(race.raceDate).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const notMember = !myMembership;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav showBack backUrl="/races" backLabel="My Races" />
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {race.logoUrl?.trim() &&
              (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
                <img
                  src={race.logoUrl}
                  alt=""
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-contain bg-white border-2 border-gray-200 flex-shrink-0 p-1"
                />
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl border-2 border-gray-200 flex-shrink-0">
                  <Trophy className="w-8 h-8" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{race.name}</h1>
                <div className="mt-2 flex flex-wrap gap-2 sm:gap-3 text-sm text-gray-600 items-center">
                  {dateLabel ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {dateLabel}
                    </span>
                  ) : null}
                  {locationText ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
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
                  {distanceChips.length === 0 ? (
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                      {distanceLabelBadge(race.distanceLabel)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {notMember ? (
        <main className="max-w-lg mx-auto px-4 py-12 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Join the Race Hub</h2>
          <p className="text-gray-600 mb-6">
            Members see who else is running, race-day chatter, meetups, and announcements.
          </p>
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={joinBusy}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold disabled:opacity-50"
          >
            {joinBusy ? "Joining…" : "I'm in"}
          </button>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
            {/* Community: chat first, then announcements, meetups, runners (minimal) */}
            <div className="lg:col-span-8 space-y-6 min-w-0 order-1">
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 min-w-0">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Race chatter</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Logistics, pacing, and meetups — this is the main thread.
                </p>
                <RaceMessageFeed
                  raceRegistryId={raceRegistryId}
                  messageListClassName="min-h-[min(18rem,45vh)] max-h-[min(32rem,60vh)]"
                />
              </section>

              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Announcements</h2>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setShowAnnounceForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700"
                    >
                      <Plus className="w-4 h-4" />
                      {showAnnounceForm ? "Cancel" : "New announcement"}
                    </button>
                  ) : null}
                </div>
                {isAdmin && showAnnounceForm ? (
                  <form
                    onSubmit={(e) => void postAnnouncement(e)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3"
                  >
                    <input
                      type="text"
                      value={announceTitle}
                      onChange={(e) => setAnnounceTitle(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Title"
                    />
                    <textarea
                      value={announceBody}
                      onChange={(e) => setAnnounceBody(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Details for the group…"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={postingAnnounce || !announceTitle.trim() || !announceBody.trim()}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        {postingAnnounce ? "Posting…" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAnnounceForm(false);
                          setAnnounceTitle("");
                          setAnnounceBody("");
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
                {announcements.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
                    No announcements yet.
                  </p>
                ) : (
                  announcements.map((a) => (
                    <AnnouncementCard
                      key={a.id}
                      announcement={{
                        id: a.id,
                        title: a.title,
                        content: a.content,
                        createdAt: a.createdAt,
                        author: {
                          firstName: a.Athlete?.firstName || "",
                          lastName: a.Athlete?.lastName || "",
                        },
                      }}
                    />
                  ))
                )}
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Meetups &amp; events</h2>
                {events.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
                    No events posted yet.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {events.map((ev) => {
                      const myStatus = ev.race_event_rsvps?.[0]?.status ?? null;
                      return (
                        <li
                          key={ev.id}
                          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                        >
                          <p className="font-semibold text-gray-900">{ev.title}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            {new Date(ev.date).toLocaleDateString()} · {ev.time} · {ev.venue}
                          </p>
                          {ev.description ? (
                            <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">
                              {ev.description}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(["going", "maybe", "not-going"] as const).map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => void setRsvp(ev.id, status)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                  myStatus === status
                                    ? status === "going"
                                      ? "bg-green-600 text-white"
                                      : status === "maybe"
                                        ? "bg-amber-500 text-white"
                                        : "bg-gray-600 text-white"
                                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                }`}
                              >
                                {status === "going"
                                  ? "Going"
                                  : status === "maybe"
                                    ? "Maybe"
                                    : "Can't go"}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="border-t border-gray-200 pt-5 mt-2">
                <button
                  type="button"
                  onClick={() => setRunnersExpanded((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 text-left rounded-xl border border-gray-100 bg-gray-50/80 hover:bg-gray-100/80 px-3 py-2.5 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">
                      Who&apos;s here
                    </span>
                    {memberships.length > 0 ? (
                      <div className="flex items-center -space-x-2">
                        {memberships.slice(0, 6).map((m) => (
                          <div
                            key={m.id}
                            className="relative w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-gray-700 shrink-0"
                            title={
                              [m.Athlete.firstName, m.Athlete.lastName]
                                .filter(Boolean)
                                .join(" ") ||
                              m.Athlete.gofastHandle ||
                              "Runner"
                            }
                          >
                            {m.Athlete.photoURL ? (
                              <img
                                src={m.Athlete.photoURL}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              memberInitials(m.Athlete)
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <span className="text-sm text-gray-500 truncate">
                      {memberships.length === 0
                        ? "No one yet"
                        : `${memberships.length} runner${memberships.length === 1 ? "" : "s"}`}
                      {memberships.length > 6
                        ? ` · +${memberships.length - 6} more`
                        : ""}
                    </span>
                  </div>
                  {runnersExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                </button>
                {runnersExpanded ? (
                  <div className="mt-3 space-y-2 max-h-[min(24rem,50vh)] overflow-y-auto pr-1">
                    {memberships.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        No members yet. Invite friends from the public race page.
                      </p>
                    ) : (
                      memberships.map((m) => (
                        <MemberDetailCard
                          key={m.id}
                          member={{
                            id: m.id,
                            athleteId: m.athleteId,
                            role: mapRaceRoleToCrewRole(m.role),
                            athlete: {
                              id: m.Athlete.id,
                              firstName: m.Athlete.firstName,
                              lastName: m.Athlete.lastName,
                              gofastHandle: m.Athlete.gofastHandle,
                              photoURL: m.Athlete.photoURL,
                              bio: m.Athlete.bio,
                            },
                            joinedAt: m.joinedAt,
                          }}
                          showRole
                          currentUserId={athleteId ?? undefined}
                        />
                      ))
                    )}
                  </div>
                ) : null}
              </section>
            </div>

            {/* Race info: one column */}
            <aside className="lg:col-span-4 space-y-6 min-w-0 order-2">
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-orange-600" />
                  Race details
                </h2>
                <div className="space-y-3 text-sm">
                  {dateLabel ? (
                    <div className="flex gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-900">Date</p>
                        <p className="text-gray-700">{dateLabel}</p>
                      </div>
                    </div>
                  ) : null}
                  {raceStartLabel ? (
                    <div className="flex gap-2">
                      <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-900">Start</p>
                        <p className="text-gray-700">{raceStartLabel}</p>
                      </div>
                    </div>
                  ) : null}
                  {locationText ? (
                    <div className="flex gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-900">Location</p>
                        <p className="text-gray-700">{locationText}</p>
                      </div>
                    </div>
                  ) : null}
                  {distanceChips.length > 0 ? (
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Distances</p>
                      <p className="text-gray-700">{distanceChips.join(" · ")}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Distance</p>
                      <p className="text-gray-700">{distanceLabelBadge(race.distanceLabel)}</p>
                    </div>
                  )}
                  {race.registrationUrl?.trim() ? (
                    <a
                      href={race.registrationUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-orange-600 font-medium hover:underline"
                    >
                      Register
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : null}
                  {race.resultsUrl?.trim() ? (
                    <a
                      href={race.resultsUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-orange-600 font-medium hover:underline"
                    >
                      Results
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : null}
                </div>
                {locationText ? (
                  <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 h-48">
                    <iframe
                      title="Race location"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={mapEmbedUrl}
                    />
                  </div>
                ) : null}
              </section>

              {(race.packetPickupLocation ||
                race.packetPickupDate ||
                race.packetPickupTime ||
                race.packetPickupDescription) && (
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-orange-600" />
                    Packet pickup
                  </h2>
                  <div className="space-y-3 text-sm">
                    {race.packetPickupLocation?.trim() ? (
                      <div>
                        <p className="font-semibold text-gray-900">Location</p>
                        <p className="text-gray-700">{race.packetPickupLocation}</p>
                      </div>
                    ) : null}
                    {(race.packetPickupDate || race.packetPickupTime) && (
                      <div>
                        <p className="font-semibold text-gray-900">Date and time</p>
                        <p className="text-gray-700">
                          {race.packetPickupDate
                            ? new Date(race.packetPickupDate).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })
                            : null}
                          {race.packetPickupDate && race.packetPickupTime?.trim()
                            ? " · "
                            : ""}
                          {race.packetPickupTime?.trim() ?? ""}
                        </p>
                      </div>
                    )}
                    {race.packetPickupDescription?.trim() ? (
                      <div>
                        <p className="font-semibold text-gray-900">Details</p>
                        <p className="text-gray-700 whitespace-pre-line">
                          {race.packetPickupDescription}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </section>
              )}

              {(race.spectatorInfo?.trim() ||
                race.logisticsInfo?.trim() ||
                race.gearDropInstructions?.trim()) && (
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Info className="w-5 h-5 text-orange-600" />
                    Spectators and logistics
                  </h2>
                  {race.spectatorInfo?.trim() ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">
                        Spectators
                      </p>
                      <div className="text-gray-700 text-sm whitespace-pre-line">
                        {race.spectatorInfo}
                      </div>
                    </div>
                  ) : null}
                  {race.logisticsInfo?.trim() ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">
                        Parking and transit
                      </p>
                      <div className="text-gray-700 text-sm whitespace-pre-line">
                        {race.logisticsInfo}
                      </div>
                    </div>
                  ) : null}
                  {race.gearDropInstructions?.trim() ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-1">
                        Gear drop / bag check
                      </p>
                      <div className="text-gray-700 text-sm whitespace-pre-line">
                        {race.gearDropInstructions}
                      </div>
                    </div>
                  ) : null}
                </section>
              )}

              {race.courseMapUrl?.trim() && isHttpOrPathUrl(race.courseMapUrl) ? (
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Route className="w-5 h-5 text-orange-600" />
                    Course map
                  </h2>
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={race.courseMapUrl.trim()}
                      alt="Course map"
                      className="w-full h-auto"
                    />
                  </div>
                </section>
              ) : null}

              {race.description?.trim() ? (
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-3">About this race</h2>
                  <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                    {race.description}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        </main>
      )}
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
