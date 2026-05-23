"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { formatRaceListDate } from "@/lib/races-display";
import {
  raceSelectorDescription,
  raceSelectorTagline,
} from "@/lib/race-selector-card";

type CatalogRace = {
  id: string;
  name: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  slug?: string | null;
  logoUrl?: string | null;
  summaryPhrase?: string | null;
  description?: string | null;
};

function hubHrefForCatalogRace(race: CatalogRace): string {
  const s = race.slug?.trim();
  return s ? `/myrace/${encodeURIComponent(s)}` : `/race-hub/${race.id}`;
}

type DiscoverRacesSectionProps = {
  signedRaceIds: Set<string>;
  onRaceAdded?: () => void;
};

export default function DiscoverRacesSection({
  signedRaceIds,
  onRaceAdded,
}: DiscoverRacesSectionProps) {
  const [catalog, setCatalog] = useState<CatalogRace[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingRaceId, setSubmittingRaceId] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ success?: boolean; race_registry?: CatalogRace[] }>(
        "/race/search?upcoming=true"
      );
      setCatalog(data.race_registry ?? []);
    } catch (e) {
      console.error(e);
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const discoverRaces = useMemo(() => {
    return catalog.filter((r) => !signedRaceIds.has(r.id)).slice(0, 3);
  }, [catalog, signedRaceIds]);

  async function onAddToCalendar(raceRegistryId: string) {
    setSubmittingRaceId(raceRegistryId);
    try {
      await api.post("/race-signups", { raceRegistryId });
      onRaceAdded?.();
      void loadCatalog();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingRaceId(null);
    }
  }

  if (loading) {
    return (
      <section className="pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-500">Loading races to discover…</p>
      </section>
    );
  }

  if (discoverRaces.length === 0) {
    return null;
  }

  return (
    <section className="pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Discover races</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Popular upcoming races — add to your calendar
          </p>
        </div>
        <Link
          href="/races/find"
          className="text-xs font-semibold text-orange-700 hover:underline shrink-0"
        >
          See all →
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {discoverRaces.map((race) => {
          const busy = submittingRaceId === race.id;
          const tagline = raceSelectorTagline(race.summaryPhrase);
          const descriptionPreview = raceSelectorDescription(race.description, 120);
          const location = [race.city, race.state].filter(Boolean).join(", ");
          const dateLine = formatRaceListDate(race.raceDate);
          const distance = race.distanceLabel?.trim() || null;

          return (
            <li
              key={race.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col"
            >
              <Link href={hubHrefForCatalogRace(race)} className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-orange-700">
                  {dateLine}
                  {distance ? ` · ${distance}` : ""}
                </p>
                <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mt-1">
                  {race.name}
                </p>
                {location ? (
                  <p className="text-[11px] text-gray-500 mt-0.5">{location}</p>
                ) : null}
                {tagline ? (
                  <p className="text-xs font-medium text-gray-700 mt-1.5 line-clamp-2">{tagline}</p>
                ) : null}
                {descriptionPreview && descriptionPreview !== tagline ? (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-snug">
                    {descriptionPreview}
                  </p>
                ) : null}
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onAddToCalendar(race.id)}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-semibold px-2.5 py-1.5 w-full"
              >
                {busy ? "Adding…" : "Add →"}
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href="/races/find"
        className="mt-3 inline-flex items-center text-sm font-semibold text-orange-700 hover:underline"
      >
        See all races →
      </Link>
    </section>
  );
}
