"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import { Calendar, MapPin, Search, ExternalLink } from "lucide-react";
import {
  countdownLabel,
  formatRaceListDate,
  formatStartTime,
} from "@/lib/races-display";

const BOSTON_TAG = "boston-qualifier";

type CatalogRace = {
  id: string;
  name: string;
  raceType: string;
  distanceMiles: number;
  raceDate: string;
  city: string | null;
  state: string | null;
  country?: string | null;
  registrationUrl: string | null;
  tags?: string[];
  startTime?: string | null;
  logoUrl?: string | null;
  slug?: string | null;
};

type Signup = {
  id: string;
  raceRegistryId: string;
  race_registry: Pick<CatalogRace, "id">;
};

export default function RacesBrowsePage() {
  const router = useRouter();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [catalog, setCatalog] = useState<CatalogRace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [bostonOnly, setBostonOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [submittingRaceId, setSubmittingRaceId] = useState<string | null>(null);

  const signedRaceIds = useMemo(
    () => new Set(signups.map((s) => s.raceRegistryId)),
    [signups]
  );

  const loadSignups = useCallback(async () => {
    try {
      const { data } = await api.get<{ signups: Signup[] }>("/race-signups");
      setSignups(data.signups ?? []);
    } catch (e) {
      console.error(e);
      setSignups([]);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const params = new URLSearchParams();
      params.set("upcoming", "true");
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (cityFilter.trim()) params.set("city", cityFilter.trim());
      if (bostonOnly) params.set("bostonQualifier", "true");
      if (dateFrom.trim()) params.set("dateFrom", dateFrom.trim());
      if (dateTo.trim()) params.set("dateTo", dateTo.trim());

      const { data } = await api.get<{ success?: boolean; race_registry?: CatalogRace[] }>(
        `/race/search?${params.toString()}`
      );
      setCatalog(data.race_registry ?? []);
    } catch (e) {
      console.error(e);
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, [debouncedSearch, cityFilter, bostonOnly, dateFrom, dateTo]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    loadSignups();
  }, [loadSignups]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) router.replace("/signup");
    });
    return () => unsub();
  }, [router]);

  async function onAddToCalendar(raceId: string) {
    setSubmittingRaceId(raceId);
    try {
      const { data } = await api.post<{ signup: Signup }>("/race-signups", {
        raceRegistryId: raceId,
      });
      if (data.signup) {
        setSignups((prev) => {
          const rest = prev.filter((s) => s.raceRegistryId !== raceId);
          return [...rest, data.signup];
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingRaceId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse races</h1>
          <p className="text-gray-600 text-sm mt-1 max-w-xl">
            Upcoming events in the registry. Add races to{" "}
            <Link href="/races/calendar" className="text-orange-600 font-medium hover:underline">
              your calendar
            </Link>
            , then set training goals from{" "}
            <Link href="/goals" className="text-orange-600 font-medium hover:underline">
              Goals
            </Link>
            .
          </p>
        </div>
      </div>

      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search by name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={bostonOnly}
                onChange={(e) => setBostonOnly(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              Boston qualifier
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Showing upcoming active races. Refine with name, city, Boston qualifier tag, or a date
          range.
        </p>

        {loadingCatalog ? (
          <p className="text-gray-500 text-sm">Loading races…</p>
        ) : catalog.length === 0 ? (
          <p className="text-gray-600 text-sm">
            No races match these filters. Try widening the date range or clearing search.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {catalog.map((race) => {
              const signedUp = signedRaceIds.has(race.id);
              const busy = submittingRaceId === race.id;
              const bq = race.tags?.includes(BOSTON_TAG);
              const startLabel = formatStartTime(race.startTime ?? null);
              return (
                <li
                  key={race.id}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col overflow-hidden"
                >
                  <div className="flex gap-4">
                    {race.logoUrl ? (
                      <div className="shrink-0 w-16 h-16 rounded-lg bg-gray-100 overflow-hidden border border-gray-100">
                        <img
                          src={race.logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="shrink-0 w-16 h-16 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-400">
                        <Calendar className="w-7 h-7" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900 text-lg leading-snug">
                          {race.name}
                        </h3>
                        {bq ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100">
                            BQ
                          </span>
                        ) : null}
                      </div>
                      <dl className="mt-2 space-y-1.5 text-sm text-gray-600">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                          <span>{formatRaceListDate(race.raceDate)}</span>
                          {startLabel ? (
                            <>
                              <span className="text-gray-400">·</span>
                              <span>{startLabel}</span>
                            </>
                          ) : null}
                          <span className="text-gray-400">·</span>
                          <span className="text-orange-600 font-medium text-xs">
                            {countdownLabel(race.raceDate)}
                          </span>
                        </div>
                        {(race.city || race.state) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                            <span>{[race.city, race.state].filter(Boolean).join(", ")}</span>
                          </div>
                        )}
                        <div>
                          {race.distanceMiles} mi · {race.raceType}
                        </div>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {signedUp ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 text-green-800 text-xs font-medium px-3 py-1">
                        On my calendar
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAddToCalendar(race.id)}
                        className="inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-medium px-4 py-2"
                      >
                        {busy ? "Saving…" : "Add to my race calendar"}
                      </button>
                    )}
                    {race.registrationUrl ? (
                      <a
                        href={race.registrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-orange-600 font-medium hover:underline"
                      >
                        Register
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
