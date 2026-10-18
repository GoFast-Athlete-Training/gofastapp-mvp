"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type {
  AnnouncementRow,
  MembershipRow,
  MyRaceResultRow,
  RaceEventRow,
  RaceSummary,
  ShakeoutRunRow,
} from "@/components/races/race-hub-types";

async function hubFetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useRaceHubPageLoad(
  resolvedRegistryId: string | null,
  resolving: boolean,
  initialRace: RaceSummary | null,
) {
  const [race, setRace] = useState<RaceSummary | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [events, setEvents] = useState<RaceEventRow[]>([]);
  const [shakeouts, setShakeouts] = useState<ShakeoutRunRow[]>([]);
  const [myMembership, setMyMembership] = useState<MembershipRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffPreview, setStaffPreview] = useState(false);
  const [isGuestSession, setIsGuestSession] = useState(true);
  const [myRaceResult, setMyRaceResult] = useState<MyRaceResultRow | null>(null);
  const [hubGoalId, setHubGoalId] = useState<string | null>(null);
  const [hubSignupId, setHubSignupId] = useState<string | null>(null);

  const id = resolvedRegistryId?.trim() ?? "";

  useEffect(() => {
    if (initialRace) setRace(initialRace);
  }, [initialRace]);

  const loadPublicSlice = useCallback(async () => {
    if (!id) return;
    const enc = encodeURIComponent(id);
    const [aRes, mRes, eRes, shRes] = await Promise.all([
      hubFetchJson<{ announcements?: AnnouncementRow[] }>(
        `/api/race-hub/${enc}/announcements`,
      ),
      hubFetchJson<{ memberships?: MembershipRow[] }>(`/api/race-hub/${enc}/members`),
      hubFetchJson<{ events?: RaceEventRow[] }>(`/api/race-hub/${enc}/events`),
      hubFetchJson<{ shakeouts?: ShakeoutRunRow[] }>(`/api/race-hub/${enc}/shakeouts`),
    ]);

    setAnnouncements(aRes?.announcements ?? []);
    setMemberships(mRes?.memberships ?? []);
    setEvents(eRes?.events ?? []);
    setShakeouts(shRes?.shakeouts ?? []);
  }, [id]);

  const loadAuthenticatedExtras = useCallback(async () => {
    if (!id) return;
    const me = LocalStorageAPI.getAthleteId();
    if (!me) {
      setMyMembership(null);
      setMyRaceResult(null);
      setHubGoalId(null);
      setHubSignupId(null);
      return;
    }

    try {
      const membersRes = await api.get(`/race-hub/${encodeURIComponent(id)}/members`);
      const list = (membersRes.data?.memberships || []) as MembershipRow[];
      setMemberships(list);
      setMyMembership(list.find((m) => m.athleteId === me) || null);
    } catch {
      /* keep public member list */
    }

    try {
      const signupsRes = await api.get("/race-signups");
      const signups =
        (signupsRes.data?.signups as { id: string; raceRegistryId: string }[] | undefined) ??
        [];
      const signupRow = signups.find((s) => s.raceRegistryId === id);
      setHubSignupId(signupRow?.id ?? null);

      const [rrRes, goalsRes] = await Promise.all([
        api
          .get("/race-results", { params: { raceRegistryId: id } })
          .catch(() => ({ data: { results: [] as unknown[] } })),
        api.get("/goals?status=ACTIVE").catch(() => ({ data: { goals: [] } })),
      ]);

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
              athlete_race?: { raceRegistryId: string } | null;
            }[]
          | undefined) ?? [];
      const goalMatch = goals.find((g) => g.athlete_race?.raceRegistryId === id);
      setHubGoalId(goalMatch?.id ?? null);
    } catch {
      /* optional authenticated hydration */
    }
  }, [id]);

  const loadStaffPreview = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    try {
      const staffRes = await api.get("/race-hub/staff/preview-access");
      const staffId = staffRes.data?.staff?.id as string | undefined;
      if (staffRes.data?.success && staffId) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("gofast_staff_preview_id", staffId);
        }
        setStaffPreview(true);
        setMyMembership(null);
        await loadPublicSlice();
        return true;
      }
    } catch {
      /* not staff */
    }
    setStaffPreview(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("gofast_staff_preview_id");
    }
    return false;
  }, [id, loadPublicSlice]);

  const reloadHub = useCallback(async () => {
    await loadPublicSlice();
    await loadAuthenticatedExtras();
  }, [loadPublicSlice, loadAuthenticatedExtras]);

  useEffect(() => {
    if (!id || resolving) return;

    let cancelled = false;

    const run = async (guest: boolean) => {
      setLoading(true);
      setError(null);
      setIsGuestSession(guest);

      if (!guest) {
        const preview = await loadStaffPreview();
        if (cancelled) return;
        if (preview) {
          setLoading(false);
          return;
        }
      }

      await loadPublicSlice();
      if (cancelled) return;

      if (!guest) {
        await loadAuthenticatedExtras();
      } else {
        setMyMembership(null);
        setMyRaceResult(null);
        setHubGoalId(null);
        setHubSignupId(null);
      }

      if (!cancelled) setLoading(false);
    };

    let unsub: (() => void) | undefined;
    try {
      const authInstance = getAuth(app);
      unsub = onAuthStateChanged(authInstance, (user) => {
        void run(!user);
      });
    } catch {
      void run(true);
    }

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [id, resolving, loadPublicSlice, loadAuthenticatedExtras, loadStaffPreview]);


  return {
    race,
    announcements,
    memberships,
    events,
    shakeouts,
    myMembership,
    loading,
    error,
    staffPreview,
    isGuestSession,
    myRaceResult,
    hubGoalId,
    hubSignupId,
    reloadHub,
    setAnnouncements,
    setEvents,
    setShakeouts,
  };
}
