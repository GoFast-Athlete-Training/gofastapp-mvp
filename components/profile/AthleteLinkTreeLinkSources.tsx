"use client";

import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { LocalStorageAPI } from "@/lib/localstorage";
import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import {
  linkIdForAthleteRace,
  linkIdForCityRun,
  linkIdForUrl,
} from "@/lib/athlete-link-tree/link-tree-race-section";
import {
  athletePublicReflectionUrl,
  athletePublicStoryUrl,
  athletePublicTipUrl,
} from "@/lib/athlete-link-tree/runner-content-public-urls";
import type { AthleteHostedRunInvite } from "@/lib/city-run/list-athlete-hosted-invites";
import { isUpcomingAthleteRace } from "@/lib/athlete-races-service";
import type { SerializedAthleteRace } from "@/lib/athlete-races-service";
import {
  ATHLETE_LINK_SOURCE_CARDS,
  normalizeLinkUrlForCompare,
  presetLinkForId,
  type AthleteContentLinkPresetId,
  type AthleteLinkSourceCardId,
} from "@/lib/athlete-link-tree/athlete-runner-public-links";
import type { AthleteRunRoutePayload } from "@/lib/gofast-with-me/athlete-run-routes";

function formatRacePickerDate(raceDate: string | Date): string {
  const d = typeof raceDate === "string" ? new Date(raceDate) : raceDate;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Props = {
  publicSlug: string;
  sortedLinks: AthleteLinkTreeLink[];
  adding: boolean;
  sections: Array<{ id: string; label: string }>;
  activeSectionId: string | null;
  onActiveSectionIdChange: (id: string | null) => void;
  onAddLink: (payload: Record<string, unknown>) => Promise<void>;
  onRemoveLink: (linkId: string) => Promise<void>;
};

export function AthleteLinkTreeLinkSources({
  publicSlug,
  sortedLinks,
  adding,
  sections,
  activeSectionId,
  onActiveSectionIdChange,
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
  const [hostedRuns, setHostedRuns] = useState<AthleteHostedRunInvite[]>([]);
  const [hostedRunsLoading, setHostedRunsLoading] = useState(false);
  const [hostedRunsError, setHostedRunsError] = useState<string | null>(null);
  const [publishedTips, setPublishedTips] = useState<
    Array<{ id: string; title: string; publishedAt: string | null }>
  >([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState<string | null>(null);
  const [publishedReflections, setPublishedReflections] = useState<
    Array<{ id: string; caption: string | null; publishedAt: string; activityName: string | null }>
  >([]);
  const [reflectionsLoading, setReflectionsLoading] = useState(false);
  const [reflectionsError, setReflectionsError] = useState<string | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [storyHasContent, setStoryHasContent] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);

  const upcomingRaces = useMemo(
    () => claimedRaces.filter((r) => isUpcomingAthleteRace(new Date(r.raceDate))),
    [claimedRaces],
  );

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

  useEffect(() => {
    if (source !== "races") return;
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
  }, [source]);

  useEffect(() => {
    if (source !== "hostedRuns") return;
    let cancelled = false;
    void (async () => {
      setHostedRunsLoading(true);
      setHostedRunsError(null);
      try {
        const res = await api.get("/me/hosted-run-invites?limit=50");
        if (!cancelled) {
          setHostedRuns((res.data.invites as AthleteHostedRunInvite[]) ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setHostedRuns([]);
          setHostedRunsError(err instanceof Error ? err.message : "Failed to load runs");
        }
      } finally {
        if (!cancelled) setHostedRunsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (source !== "thoughts") return;
    let cancelled = false;
    void (async () => {
      setTipsLoading(true);
      setTipsError(null);
      try {
        const res = await api.get("/athlete/links/published-tips");
        if (!res.data?.success) throw new Error(res.data?.error || "Failed to load think pieces");
        if (!cancelled) setPublishedTips(res.data.tips ?? []);
      } catch (err) {
        if (!cancelled) {
          setPublishedTips([]);
          setTipsError(err instanceof Error ? err.message : "Failed to load think pieces");
        }
      } finally {
        if (!cancelled) setTipsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (source !== "reflections") return;
    let cancelled = false;
    void (async () => {
      setReflectionsLoading(true);
      setReflectionsError(null);
      try {
        const res = await api.get("/athlete/links/published-reflections");
        if (!res.data?.success) {
          throw new Error(res.data?.error || "Failed to load reflections");
        }
        if (!cancelled) setPublishedReflections(res.data.reflections ?? []);
      } catch (err) {
        if (!cancelled) {
          setPublishedReflections([]);
          setReflectionsError(err instanceof Error ? err.message : "Failed to load reflections");
        }
      } finally {
        if (!cancelled) setReflectionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (source !== "story") return;
    let cancelled = false;
    void (async () => {
      setStoryLoading(true);
      setStoryError(null);
      try {
        const res = await api.get("/athlete/links/runner-story");
        if (!res.data?.success) throw new Error(res.data?.error || "Failed to load story");
        if (!cancelled) {
          setStoryHasContent(Boolean(res.data.hasStory));
          setStoryPreview(typeof res.data.preview === "string" ? res.data.preview : null);
        }
      } catch (err) {
        if (!cancelled) {
          setStoryHasContent(false);
          setStoryPreview(null);
          setStoryError(err instanceof Error ? err.message : "Failed to load story");
        }
      } finally {
        if (!cancelled) setStoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  function sectionRequiredBanner() {
    if (sections.length === 0) {
      return (
        <p className="text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
          Add a section on the right first, then pick it above or click the section heading.
        </p>
      );
    }
    if (!activeSectionId) {
      return (
        <p className="text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
          Choose a section above or click a section on the right before adding links.
        </p>
      );
    }
    return null;
  }

  function formatRunPickerDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatRunPickerTime(run: AthleteHostedRunInvite): string {
    if (run.startTimeHour == null || run.startTimeMinute == null) return "";
    const min = run.startTimeMinute.toString().padStart(2, "0");
    return `${run.startTimeHour}:${min} ${run.startTimePeriod || "AM"}`;
  }

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

  async function toggleHostedRunOnPage(run: AthleteHostedRunInvite, checked: boolean) {
    const existingId = linkIdForCityRun(sortedLinks, run.id);
    if (checked) {
      if (existingId) return;
      if (!activeSectionId) return;
      await onAddLink({
        kind: "CITY_RUN",
        cityRunId: run.id,
      });
      return;
    }
    if (existingId) {
      await onRemoveLink(existingId);
    }
  }

  async function toggleTipOnPage(
    tip: { id: string; title: string },
    checked: boolean,
  ) {
    const url = athletePublicTipUrl(publicSlug, tip.id);
    const existingId = linkIdForUrl(sortedLinks, url);
    if (checked) {
      if (existingId || !activeSectionId) return;
      await onAddLink({
        name: tip.title.trim() || "Think piece",
        publicLabel: tip.title.trim() || "Think piece",
        url,
        emoji: "💭",
      });
      return;
    }
    if (existingId) await onRemoveLink(existingId);
  }

  async function toggleReflectionOnPage(
    post: { id: string; caption: string | null; activityName: string | null; publishedAt: string },
    checked: boolean,
  ) {
    const url = athletePublicReflectionUrl(publicSlug, post.id);
    const existingId = linkIdForUrl(sortedLinks, url);
    const title =
      post.caption?.trim().slice(0, 80) ||
      post.activityName?.trim() ||
      "Training reflection";
    if (checked) {
      if (existingId || !activeSectionId) return;
      await onAddLink({
        name: title,
        publicLabel: title,
        url,
        emoji: "📝",
      });
      return;
    }
    if (existingId) await onRemoveLink(existingId);
  }

  async function addStoryLink() {
    const url = athletePublicStoryUrl(publicSlug);
    if (urlAlreadyOnPage(url) || !activeSectionId) return;
    await onAddLink({
      name: "Runner story",
      publicLabel: "Runner story",
      url,
      emoji: "📖",
    });
    setSource(null);
  }

  async function toggleRaceOnPage(race: SerializedAthleteRace, checked: boolean) {
    const existingId = linkIdForAthleteRace(sortedLinks, race.id);
    if (checked) {
      if (existingId) return;
      if (!activeSectionId) return;
      await onAddLink({
        kind: "ATHLETE_RACE",
        athleteRaceId: race.id,
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
    if (id === "landing" || id === "runs") {
      const preset = presetLinkForId(id, publicSlug);
      return urlAlreadyOnPage(preset.url);
    }
    if (id === "story") {
      return urlAlreadyOnPage(athletePublicStoryUrl(publicSlug));
    }
    return false;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">Add to page</h3>
        {source ? (
          <button
            type="button"
            onClick={() => setSource(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        ) : null}
      </div>

      <label className="block text-sm">
        <span className="font-medium text-gray-800">Under section</span>
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          value={activeSectionId ?? ""}
          onChange={(e) => onActiveSectionIdChange(e.target.value.trim() || null)}
        >
          <option value="">Top of page</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {!source ? (
        <div className="grid gap-2">
          {ATHLETE_LINK_SOURCE_CARDS.map((card) => {
            const disabled = cardDisabled(card.id);
            return (
              <button
                key={card.id}
                type="button"
                disabled={disabled}
                onClick={() => setSource(card.id)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block text-sm font-semibold text-gray-900">{card.title}</span>
                <span className="block text-xs text-gray-500">
                  {card.hint}
                  {disabled &&
                  card.id !== "custom" &&
                  card.id !== "routes" &&
                  card.id !== "races" &&
                  card.id !== "hostedRuns" &&
                  card.id !== "thoughts" &&
                  card.id !== "reflections"
                    ? " · Already added"
                    : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {source === "landing" || source === "runs" ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 break-all">{presetLinkForId(source, publicSlug).url}</p>
          <button
            type="button"
            disabled={adding || cardDisabled(source)}
            onClick={() => void addPreset(source)}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add link"}
          </button>
        </div>
      ) : null}

      {source === "story" ? (
        <div className="space-y-2">
          {sectionRequiredBanner()}
          {storyLoading ? <p className="text-xs text-gray-500">Loading story…</p> : null}
          {storyError ? <p className="text-xs text-red-700">{storyError}</p> : null}
          {!storyLoading && !storyError && !storyHasContent ? (
            <p className="text-xs text-gray-500">No runner story published yet.</p>
          ) : null}
          {storyPreview ? (
            <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-4">{storyPreview}</p>
          ) : null}
          <p className="text-xs text-gray-500 break-all">{athletePublicStoryUrl(publicSlug)}</p>
          <button
            type="button"
            disabled={adding || !activeSectionId || !storyHasContent || cardDisabled("story")}
            onClick={() => void addStoryLink()}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add link"}
          </button>
        </div>
      ) : null}

      {source === "thoughts" ? (
        <div className="space-y-2">
          {sectionRequiredBanner()}
          {tipsLoading ? <p className="text-xs text-gray-500">Loading think pieces…</p> : null}
          {tipsError ? <p className="text-xs text-red-700">{tipsError}</p> : null}
          {!tipsLoading && !tipsError && publishedTips.length === 0 ? (
            <p className="text-xs text-gray-500">No published think pieces yet.</p>
          ) : null}
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {publishedTips.map((tip) => {
              const url = athletePublicTipUrl(publicSlug, tip.id);
              const onPage = Boolean(linkIdForUrl(sortedLinks, url));
              const disabled = adding || !activeSectionId;
              return (
                <li key={tip.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={onPage}
                      disabled={disabled}
                      onChange={(e) => void toggleTipOnPage(tip, e.target.checked)}
                    />
                    <span className="font-medium text-gray-900">{tip.title}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {source === "reflections" ? (
        <div className="space-y-2">
          {sectionRequiredBanner()}
          {reflectionsLoading ? <p className="text-xs text-gray-500">Loading reflections…</p> : null}
          {reflectionsError ? <p className="text-xs text-red-700">{reflectionsError}</p> : null}
          {!reflectionsLoading && !reflectionsError && publishedReflections.length === 0 ? (
            <p className="text-xs text-gray-500">No published reflections yet.</p>
          ) : null}
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {publishedReflections.map((post) => {
              const url = athletePublicReflectionUrl(publicSlug, post.id);
              const onPage = Boolean(linkIdForUrl(sortedLinks, url));
              const disabled = adding || !activeSectionId;
              const label =
                post.caption?.trim().slice(0, 80) ||
                post.activityName?.trim() ||
                "Training reflection";
              const meta = post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "";
              return (
                <li key={post.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={onPage}
                      disabled={disabled}
                      onChange={(e) => void toggleReflectionOnPage(post, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">{label}</span>
                      {meta ? <span className="mt-0.5 block text-xs text-gray-500">{meta}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {source === "hostedRuns" ? (
        <div className="space-y-2">
          {sectionRequiredBanner()}
          {hostedRunsLoading ? <p className="text-xs text-gray-500">Loading runs…</p> : null}
          {hostedRunsError ? <p className="text-xs text-red-700">{hostedRunsError}</p> : null}
          {!hostedRunsLoading && !hostedRunsError && hostedRuns.length === 0 ? (
            <p className="text-xs text-gray-500">
              No run invites yet. Create one from Run → Create a run; it will show here newest
              first.
            </p>
          ) : null}
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {hostedRuns.map((run) => {
              const onPage = Boolean(linkIdForCityRun(sortedLinks, run.id));
              const disabled = adding || !activeSectionId;
              const meta = [
                formatRunPickerDate(run.date),
                formatRunPickerTime(run),
                run.totalMiles != null ? `${run.totalMiles} mi` : null,
                run.pace?.trim(),
                run.isUpcoming ? "Upcoming" : "Past",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={run.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={onPage}
                      disabled={disabled}
                      onChange={(e) => void toggleHostedRunOnPage(run, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">{run.title}</span>
                      {meta ? <span className="mt-0.5 block text-xs text-gray-500">{meta}</span> : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {source === "races" ? (
        <div className="space-y-2">
          {sectionRequiredBanner()}
          {racesLoading ? <p className="text-xs text-gray-500">Loading races…</p> : null}
          {racesError ? <p className="text-xs text-red-700">{racesError}</p> : null}
          {!racesLoading && !racesError && upcomingRaces.length === 0 ? (
            <p className="text-xs text-gray-500">No upcoming races on your profile.</p>
          ) : null}
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {upcomingRaces.map((race) => {
              const onPage = Boolean(linkIdForAthleteRace(sortedLinks, race.id));
              const disabled = adding || !activeSectionId || !race.slug?.trim();
              const meta = [formatRacePickerDate(race.raceDate), race.distanceLabel?.trim()]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={race.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-2 py-2 text-sm hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={onPage}
                      disabled={disabled}
                      onChange={(e) => void toggleRaceOnPage(race, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">{race.name}</span>
                      {meta ? <span className="mt-0.5 block text-xs text-gray-500">{meta}</span> : null}
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
          {routesLoading ? <p className="text-xs text-gray-500">Loading routes…</p> : null}
          {routesError ? <p className="text-xs text-red-700">{routesError}</p> : null}
          {!routesLoading && !routesError && routes.length === 0 ? (
            <p className="text-xs text-gray-500">No saved routes yet.</p>
          ) : null}
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {routes.map((row) => {
              const url = row.route.stravaUrl?.trim() || row.route.stravaMapUrl?.trim();
              const disabled = !url || urlAlreadyOnPage(url);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={adding || disabled}
                    onClick={() => void addRoute(row)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm ring-1 ring-gray-200 hover:bg-sky-50 disabled:opacity-50"
                  >
                    <span className="font-medium">{row.route.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {source === "custom" ? (
        <form
          className="space-y-2"
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
          <input
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Button title"
            required
          />
          <input
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://"
            required
          />
          <button
            type="submit"
            disabled={adding || !customTitle.trim() || !customUrl.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add link"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
