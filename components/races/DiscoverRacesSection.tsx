"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { formatRaceListDate } from "@/lib/races-display";
import {
  raceSelectorDescription,
  raceSelectorTagline,
} from "@/lib/race-selector-card";
import { AdjustPlanPrompt } from "@/components/training/PlanSecondaryRacesReview";

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
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogRace[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingRaceId, setSubmittingRaceId] = useState<string | null>(null);
  const [adjustPrompt, setAdjustPrompt] = useState<{
    planId: string;
    weekNumber: number | null;
    raceName: string;
    impactSummary: string[];
  } | null>(null);

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

  async function onClaimRace(raceRegistryId: string, raceName: string) {
    setSubmittingRaceId(raceRegistryId);
    setAdjustPrompt(null);
    try {
      const { data } = await api.post<{
        athleteRace?: { id: string };
        signup?: { id: string };
        planImpact?: {
          affectsPlan: boolean;
          planId: string | null;
          weekNumber: number | null;
        };
        impactPreview?: { nearbyChanges?: string[] } | null;
      }>("/athlete-races", { raceRegistryId });
      const athleteRace = data.athleteRace ?? data.signup;
      onRaceAdded?.();
      void loadCatalog();
      if (data.planImpact?.affectsPlan && data.planImpact.planId) {
        setAdjustPrompt({
          planId: data.planImpact.planId,
          weekNumber: data.planImpact.weekNumber,
          raceName,
          impactSummary: data.impactPreview?.nearbyChanges ?? [],
        });
      }
      if (athleteRace?.id) {
        router.push(`/races/setup/${encodeURIComponent(athleteRace.id)}`);
      }
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
      {adjustPrompt ? (
        <div className="mb-4">
          <AdjustPlanPrompt
            planId={adjustPrompt.planId}
            weekNumber={adjustPrompt.weekNumber}
            raceName={adjustPrompt.raceName}
            impactSummary={adjustPrompt.impactSummary}
            onDismiss={() => setAdjustPrompt(null)}
          />
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Discover races</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Upcoming races — tap when you&apos;re running one
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
              <Link
                href={hubHrefForCatalogRace(race)}
                className="flex min-w-0 flex-1 items-start gap-3"
              >
                {race.logoUrl ? (
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-100">
                    <img
                      src={race.logoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
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
                    <p className="text-xs font-medium text-gray-700 mt-1.5 line-clamp-2">
                      {tagline}
                    </p>
                  ) : null}
                  {descriptionPreview && descriptionPreview !== tagline ? (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-snug">
                      {descriptionPreview}
                    </p>
                  ) : null}
                </div>
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onClaimRace(race.id, race.name)}
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-xs font-semibold px-2.5 py-1.5 w-full"
              >
                {busy ? "Saving…" : "I'm running this race"}
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
