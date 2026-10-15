"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import {
  insertAfterIdForSection,
  linkIdForAthleteRace,
  sectionOptions,
} from "@/lib/athlete-link-tree/link-tree-race-section";
import type { SerializedAthleteRace } from "@/lib/athlete-races-service";
import {
  ATHLETE_LINK_SOURCE_CARDS,
  normalizeLinkUrlForCompare,
  presetLinkForId,
  type AthleteContentLinkPresetId,
  type AthleteLinkSourceCardId,
} from "@/lib/athlete-link-tree/athlete-runner-public-links";
import type { AthleteRunRoutePayload } from "@/lib/gofast-with-me/athlete-run-routes";
type Props = {
  publicSlug: string;
  sortedLinks: AthleteLinkTreeLink[];
  adding: boolean;
  onAddLink: (payload: Record<string, unknown>) => Promise<void>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

export function AthleteLinkTreeLinkSources({
  publicSlug,
  sortedLinks,
  adding,
  onAddLink,
  onRemoveLink,
}: Props) {
  const [source, setSource] = useState<AthleteLinkSourceCardId | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [customUrl, setCustomUrl] = useState("https://");
  const [routes, setRoutes] = useState<AthleteRunRoutePayload[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [claimedRaces, setClaimedRaces] = useState<SerializedAthleteRace[]>([]);
  const [racesLoading, setRacesLoading] = useState(false);
  const [racesError, setRacesError] = useState<string | null>(null);
  const [raceSectionId, setRaceSectionId] = useState("");
  const sections = sectionOptions(sortedLinks);

  const existingUrls = useCallback(() => {
    return new Set(
      sortedLinks
        .filter((l) => !l.isSection && l.url?.trim())
        .map((l) => normalizeLinkUrlForCompare(l.url!)),
    );
  }, [sortedLinks]);

  const urlAlreadyOnPage = (url: string) => existingUrls().has(normalizeLinkUrlForCompare(url));

  useEffect(() => {
    if (source !== "routes") return;
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) return;
    let cancelled = false;
    void (async () => {
      setRoutesLoading(true);
      setRoutesError(null);
      try {
        const res = await api.get(`/athlete/${athleteId}/run-routes`);
        if (!res.data?.success) {
          throw new Error(res.data?.error || "Failed to load routes");
        }
        if (!cancelled) {
          setRoutes((res.data.runRoutes as AthleteRunRoutePayload[]) ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setRoutes([]);
          setRoutesError(err instanceof Error ? err.message : "Failed to load routes");
        }
      } finally {
        if (!cancelled) setRoutesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  async function addPreset(id: AthleteContentLinkPresetId) {
    const preset = presetLinkForId(id, publicSlug);
    if (urlAlreadyOnPage(preset.url)) return;
    const title = preset.title;
    await onAddLink({
      name: title,
      publicLabel: title,
      url: preset.url,
      emoji: preset.emoji,
    });
    setSource(null);
  }

  useEffect(() => {
    if (source !== "races") return;
    if (sections.length > 0 && !raceSectionId) {
      setRaceSectionId(sections[0]!.id);
    }
    let cancelled = false;
    void (async () => {
      setRacesLoading(true);
      setRacesError(null);
      try {
        const res = await api.get("/athlete-races");
        if (!cancelled) {
          const rows = (res.data?.athleteRaces ?? res.data?.signups) as SerializedAthleteRace[] | undefined;
          if (!rows) {
            throw new Error(res.data?.error || "Failed to load races");
          }
          setClaimedRaces(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setClaimedRaces([]);
          setRacesError(err instanceof Error ? err.message : "Failed to load races");
        }
      } finally {
        if (!cancelled) setRacesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, raceSectionId, sections.length]);

  async function toggleRaceOnPage(race: SerializedAthleteRace, checked: boolean) {
    const existingId = linkIdForAthleteRace(sortedLinks, race.id);
    if (checked) {
      if (existingId) return;
      if (!raceSectionId) return;
      const insertAfterId = insertAfterIdForSection(sortedLinks, raceSectionId);
      if (!insertAfterId) return;
      await onAddLink({
        kind: "ATHLETE_RACE",
        athleteRaceId: race.id,
        insertAfterId,
      });
      return;
    }
    if (existingId) {
      await onRemoveLink(existingId);
    }
  }

  async function addRoute(route: AthleteRunRoutePayload) {
    const url = route.route.stravaUrl?.trim() || route.route.stravaMapUrl?.trim();
    if (!url || urlAlreadyOnPage(url)) return;
    const title = route.route.name.trim() || "Route";
    await onAddLink({
      name: title,
      publicLabel: title,
      url,
      emoji: "📍",
    });
    setSource(null);
  }

  function cardDisabled(id: AthleteLinkSourceCardId): boolean {
    if (adding) return true;
    if (
      id === "landing" ||
      id === "story" ||
      id === "reflections" ||
      id === "thoughts" ||
      id === "runs"
    ) {
      const preset = presetLinkForId(id, publicSlug);
      return urlAlreadyOnPage(preset.url);
    }
    return false;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Add a link</h3>
          <p className="mt-1 text-sm text-gray-600">
            Pick a public URL to show as a button — we add the real link, not an editor.
          </p>
        </div>
        {source ? (
          <button
            type="button"
            onClick={() => setSource(null)}
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        ) : null}
      </div>

      {!source ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {ATHLETE_LINK_SOURCE_CARDS.map((card) => {
            const disabled = cardDisabled(card.id);
            return (
              <button
                key={card.id}
                type="button"
                disabled={disabled}
                onClick={() => setSource(card.id)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block font-semibold text-gray-900">{card.title}</span>
                <span className="mt-0.5 block text-sm text-gray-500">
                  {card.hint}
                  {disabled && card.id !== "custom" && card.id !== "routes" && card.id !== "races"
                    ? " · Already added"
                    : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {source === "landing" ||
      source === "story" ||
      source === "reflections" ||
      source === "thoughts" ||
      source === "runs" ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Adds one button to{" "}
            <span className="font-medium">{presetLinkForId(source, publicSlug).url}</span>
          </p>
          <button
            type="button"
            disabled={adding || cardDisabled(source)}
            onClick={() => void addPreset(source)}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add link"}
          </button>
        </div>
      ) : null}

      {source === "races" ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Add a section heading first (for example &ldquo;My Races&rdquo;), then check which
            claimed races appear under it. Links are generated automatically.
          </p>
          {sections.length === 0 ? (
            <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              Add a section heading above before choosing races.
            </p>
          ) : (
            <label className="block text-sm">
              <span className="font-medium text-gray-800">Under section</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={raceSectionId}
                onChange={(e) => setRaceSectionId(e.target.value)}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {racesLoading ? <p className="text-sm text-gray-500">Loading your races…</p> : null}
          {racesError ? <p className="text-sm text-red-700">{racesError}</p> : null}
          {!racesLoading && !racesError && claimedRaces.length === 0 ? (
            <p className="text-sm text-gray-500">No claimed races yet — claim a race in the app first.</p>
          ) : null}
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {claimedRaces.map((race) => {
              const onPage = Boolean(linkIdForAthleteRace(sortedLinks, race.id));
              const disabled = adding || !raceSectionId || !race.slug?.trim();
              return (
                <li key={race.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={onPage}
                      disabled={disabled}
                      onChange={(e) => void toggleRaceOnPage(race, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">{race.name}</span>
                      {!race.slug?.trim() ? (
                        <span className="mt-0.5 block text-xs text-gray-500">Missing public slug</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {source === "routes" ? (
        <div className="space-y-2">
          {routesLoading ? <p className="text-sm text-gray-500">Loading your routes…</p> : null}
          {routesError ? <p className="text-sm text-red-700">{routesError}</p> : null}
          {!routesLoading && !routesError && routes.length === 0 ? (
            <p className="text-sm text-gray-500">
              No saved routes yet — add routes from Build content.
            </p>
          ) : null}
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {routes.map((row) => {
              const url = row.route.stravaUrl?.trim() || row.route.stravaMapUrl?.trim();
              const disabled = !url || urlAlreadyOnPage(url);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={adding || disabled}
                    onClick={() => void addRoute(row)}
                    className="w-full rounded-lg bg-white px-3 py-2 text-left text-sm ring-1 ring-gray-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="font-medium">{row.route.name}</span>
                    {!url ? (
                      <span className="mt-0.5 block text-xs text-gray-500">No Strava URL</span>
                    ) : urlAlreadyOnPage(url) ? (
                      <span className="mt-0.5 block text-xs text-gray-500">Already on your page</span>
                    ) : (
                      <span className="mt-0.5 block truncate text-xs text-gray-500">{url}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {source === "custom" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const title = customTitle.trim();
            const url = customUrl.trim();
            if (!title || !url) return;
            void onAddLink({
              name: title,
              publicLabel: title,
              url,
              emoji: "🌐",
            }).then(() => {
              setCustomTitle("");
              setCustomUrl("https://");
              setSource(null);
            });
          }}
        >
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Button title</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-800">URL</span>
            <input
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://"
              required
            />
          </label>
          <button
            type="submit"
            disabled={adding || !customTitle.trim() || !customUrl.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add link"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
