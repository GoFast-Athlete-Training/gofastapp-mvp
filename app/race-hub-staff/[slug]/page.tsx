"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import RaceHubMobileTabs from "@/components/races/RaceHubMobileTabs";
import RaceHubChatterSection from "@/components/races/RaceHubChatterSection";
import RaceHubAnnouncementsSection from "@/components/races/RaceHubAnnouncementsSection";
import { RaceHubAtAGlanceSection } from "@/components/races/RaceHubInfoSections";
import {
  RaceHubEventsSection,
  RaceHubShakeoutsSection,
} from "@/components/races/RaceHubEventsSections";
import RaceHubPeopleSection from "@/components/races/RaceHubPeopleSection";
import RaceHubStaffInfoPacketsSection from "@/components/races/RaceHubStaffInfoPacketsSection";
import {
  distanceSnapToChips,
  formatDistanceFallback,
  formatRaceStartTimeLabel,
  type AnnouncementRow,
  type MembershipRow,
  type RaceEventRow,
  type RaceSummary,
  type ShakeoutRunRow,
} from "@/components/races/race-hub-types";
import {
  getPublicCoursePageUrl,
  getPublicRacePageUrl,
} from "@/lib/public-race-url";
import type { RaceInfoPacket } from "@/lib/races/race-info-packet-types";
import { Calendar, MapPin, Trophy } from "lucide-react";

function RaceHubStaffPageInner() {
  const params = useParams();
  const slugParam = (params.slug as string)?.trim() || "";

  const [raceRegistryId, setRaceRegistryId] = useState<string | null>(null);
  const [race, setRace] = useState<RaceSummary | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [events, setEvents] = useState<RaceEventRow[]>([]);
  const [shakeouts, setShakeouts] = useState<ShakeoutRunRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [infoPackets, setInfoPackets] = useState<RaceInfoPacket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slugParam) {
      setError("missing");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resolveRes = await fetch(
        `/api/race-hub/public/resolve-by-slug/${encodeURIComponent(slugParam)}`
      );
      if (!resolveRes.ok) {
        setError("not_found");
        setRace(null);
        return;
      }
      const resolveData = await resolveRes.json();
      const resolved = resolveData.race as {
        id: string;
        name: string;
        slug: string | null;
        logoUrl: string | null;
        raceDate: string;
        city: string | null;
        state: string | null;
        distanceLabel: string | null;
        distanceMeters: number | null;
      };
      if (!resolveData.success || !resolved?.id) {
        setError("not_found");
        setRace(null);
        return;
      }

      setRaceRegistryId(resolved.id);
      setRace({
        id: resolved.id,
        name: resolved.name,
        slug: resolved.slug,
        companyRaceId: null,
        raceDate: resolved.raceDate,
        city: resolved.city,
        state: resolved.state,
        distanceMeters: resolved.distanceMeters,
        logoUrl: resolved.logoUrl,
        distanceLabel: resolved.distanceLabel,
        startTime: null,
        courseSlug: null,
      });

      const id = resolved.id;
      const [aRes, eRes, shRes, mRes, pktRes] = await Promise.all([
        api.get(`/race-hub/${encodeURIComponent(id)}/announcements`),
        api.get(`/race-hub/${encodeURIComponent(id)}/events`),
        api.get(`/race-hub/${encodeURIComponent(id)}/shakeouts`),
        api.get(`/race-hub/${encodeURIComponent(id)}/members`),
        api.get(`/race-registry/${encodeURIComponent(id)}/info-packets`),
      ]);

      setAnnouncements((aRes.data?.announcements as AnnouncementRow[]) || []);
      setEvents((eRes.data?.events as RaceEventRow[]) || []);
      setShakeouts((shRes.data?.shakeouts as ShakeoutRunRow[]) || []);
      setMemberships((mRes.data?.memberships as MembershipRow[]) || []);
      const packets = (pktRes.data?.packets as RaceInfoPacket[] | undefined) ?? [];
      setInfoPackets(packets);
    } catch (e) {
      console.error("Staff race hub load:", e);
      setError("error");
    } finally {
      setLoading(false);
    }
  }, [slugParam]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !race || !raceRegistryId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Race hub not available</h2>
          <p className="text-sm text-gray-600">
            Publish this race to prod or check the slug on Race Manage.
          </p>
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

  const noopRsvp = () => undefined;

  const sharedSectionProps = {
    raceRegistryId,
    announcements,
    isAdmin: false,
    showAnnounceForm: false,
    onToggleAnnounceForm: () => undefined,
    announceTitle: "",
    announceBody: "",
    onAnnounceTitleChange: () => undefined,
    onAnnounceBodyChange: () => undefined,
    onCancelAnnounceForm: () => undefined,
    onPostAnnouncement: (e: React.FormEvent) => {
      e.preventDefault();
    },
    postingAnnounce: false,
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
    currentUserId: undefined,
    onSetShakeoutRunRsvp: noopRsvp,
    onSetRsvp: noopRsvp,
    showPostRaceResultCard: false,
    myRaceResult: null,
    onOpenLogSheet: () => undefined,
    readOnly: true,
    infoPackets,
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-950">
        Staff race hub — read-only preview. Athletes join on the athlete app.
      </div>
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            {race.logoUrl?.trim() &&
            (race.logoUrl.startsWith("http") || race.logoUrl.startsWith("/")) ? (
              <img
                src={race.logoUrl}
                alt=""
                className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl object-contain bg-white border-2 border-gray-200 flex-shrink-0 p-1"
              />
            ) : (
              <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border-2 border-gray-200 flex-shrink-0">
                <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{race.name}</h1>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-600 items-center">
                {dateLabel ? (
                  <span className="flex items-center gap-1 min-w-0">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {dateLabel}
                      {raceStartLabel ? ` · ${raceStartLabel}` : ""}
                    </span>
                  </span>
                ) : null}
                {locationText ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {locationText}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-6">
        <RaceHubMobileTabs {...sharedSectionProps} />

        <div className="hidden lg:grid grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6 min-w-0">
            <RaceHubChatterSection raceRegistryId={raceRegistryId} readOnly />
            <RaceHubAnnouncementsSection
              announcements={announcements}
              isAdmin={false}
              showAnnounceForm={false}
              onToggleAnnounceForm={() => undefined}
              announceTitle=""
              announceBody=""
              onAnnounceTitleChange={() => undefined}
              onAnnounceBodyChange={() => undefined}
              onCancelAnnounceForm={() => undefined}
              onPostAnnouncement={(e) => e.preventDefault()}
              postingAnnounce={false}
            />
          </div>
          <aside className="lg:col-span-6 space-y-6 min-w-0">
            <RaceHubAtAGlanceSection
              dateLabel={dateLabel}
              raceStartLabel={raceStartLabel}
              locationText={locationText}
              distanceChips={distanceChips}
              distanceFallback={distanceFallback}
              publicRaceUrl={publicRaceUrl}
              courseTipsUrl={courseTipsUrl}
            />
            <RaceHubStaffInfoPacketsSection packets={infoPackets} />
            <RaceHubShakeoutsSection shakeouts={shakeouts} onSetShakeoutRunRsvp={noopRsvp} readOnly />
            <RaceHubEventsSection events={events} onSetRsvp={noopRsvp} readOnly />
            <RaceHubPeopleSection
              memberships={memberships}
              runnersExpanded
              onToggleRunnersExpanded={() => undefined}
              expanded
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function RaceHubStaffPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <RaceHubStaffPageInner />
    </Suspense>
  );
}
