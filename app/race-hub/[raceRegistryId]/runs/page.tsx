"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import {
  RaceHubEventsSection,
  RaceHubShakeoutsSection,
} from "@/components/races/RaceHubEventsSections";
import type { RaceEventRow, RaceSummary, ShakeoutRunRow } from "@/components/races/race-hub-types";
import { isRaceRegistryUuid, raceHubPath } from "@/lib/race-hub-urls";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";
import api from "@/lib/api";
import { auth } from "@/lib/firebase";

async function hubFetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function RaceHubRunsPageInner() {
  const params = useParams();
  const router = useRouter();
  const routeParam = (params.raceRegistryId as string)?.trim() || "";

  const [resolvedRegistryId, setResolvedRegistryId] = useState<string | null>(null);
  const [raceSlug, setRaceSlug] = useState<string | null>(null);
  const [raceName, setRaceName] = useState<string>("Race hub");
  const [shakeouts, setShakeouts] = useState<ShakeoutRunRow[]>([]);
  const [events, setEvents] = useState<RaceEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(true);

  useEffect(() => {
    if (!routeParam) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function resolveAndLoad() {
      const res = await fetch(
        `/api/race-hub/public/resolve-by-slug/${encodeURIComponent(routeParam)}`,
      );
      if (!res.ok || cancelled) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const resolved = data.race as RaceSummary | undefined;
      if (!data.success || !resolved?.id) {
        setLoading(false);
        return;
      }
      const slug = resolved.slug?.trim() || null;
      setResolvedRegistryId(resolved.id);
      setRaceSlug(slug);
      setRaceName(resolved.name);
      if (slug && isRaceRegistryUuid(routeParam) && slug !== routeParam) {
        router.replace(`${raceHubPath(slug)}/runs`);
      }

      const enc = encodeURIComponent(resolved.id);
      const [shRes, eRes] = await Promise.all([
        hubFetchJson<{ shakeouts?: ShakeoutRunRow[] }>(`/api/race-hub/${enc}/shakeouts`),
        hubFetchJson<{ events?: RaceEventRow[] }>(`/api/race-hub/${enc}/events`),
      ]);
      if (!cancelled) {
        setShakeouts(shRes?.shakeouts ?? []);
        setEvents(eRes?.events ?? []);
        setLoading(false);
      }
    }

    void resolveAndLoad();
    return () => {
      cancelled = true;
    };
  }, [routeParam, router]);

  useEffect(() => {
    try {
      const authInstance = getAuth(app);
      const unsub = onAuthStateChanged(authInstance, (user) => setIsGuest(!user));
      return () => unsub();
    } catch {
      setIsGuest(true);
      return undefined;
    }
  }, []);

  const signInToRsvp = useCallback(() => {
    const slug = raceSlug || routeParam;
    router.push(`/signup?redirect=${encodeURIComponent(`${raceHubPath(slug)}/runs`)}`);
  }, [raceSlug, routeParam, router]);

  const setShakeoutRunRsvp = async (runId: string, status: "going" | "not-going") => {
    if (isGuest || !auth.currentUser) {
      signInToRsvp();
      return;
    }
    const id = resolvedRegistryId?.trim();
    if (!id) return;
    try {
      await api.post(`/runs/${encodeURIComponent(runId)}/rsvp`, { status });
      const sRes = await api.get(`/race-hub/${encodeURIComponent(id)}/shakeouts`);
      setShakeouts((sRes.data?.shakeouts as ShakeoutRunRow[]) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const setRsvp = async (eventId: string, status: "going" | "not-going" | "maybe") => {
    if (isGuest || !auth.currentUser) {
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
      setEvents((eRes.data?.events as RaceEventRow[]) || []);
    } catch (err) {
      console.error(err);
    }
  };

  const hubHref = raceSlug ? raceHubPath(raceSlug) : resolvedRegistryId ? raceHubPath(resolvedRegistryId) : "/races";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-orange-50 overflow-x-hidden">
      <TopNav showBack backUrl={hubHref} backLabel="Hub" />
      <div className="mx-auto w-full max-w-md px-4 py-6 sm:py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">{raceName}</h1>
          <p className="mt-1 text-sm text-gray-600">Official shakeouts and group meetups</p>
        </header>

        <RaceHubShakeoutsSection shakeouts={shakeouts} onSetShakeoutRunRsvp={setShakeoutRunRsvp} />
        <RaceHubEventsSection events={events} onSetRsvp={setRsvp} />

        <p className="text-center text-xs text-gray-500">
          <Link href={hubHref} className="font-semibold text-sky-700 hover:underline">
            Back to race hub
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RaceHubRunsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <RaceHubRunsPageInner />
    </Suspense>
  );
}
