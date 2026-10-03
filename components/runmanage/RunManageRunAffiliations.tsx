"use client";

import { useCallback, useState } from "react";
import { Loader2, X } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  type PartnerExtra,
  type StaffCreateRunType,
  STAFF_CREATE_RUN_TYPES,
  runTypeHasOpenAffiliations,
  parsePartnerExtras,
} from "@/lib/runmanage/partner-extras";
import type { RunManageStaffCreateRunType } from "@/lib/runmanage/create-run-scope";

export type AffiliationPick = {
  id: string;
  name: string;
  logoUrl?: string | null;
  secondary?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  websiteUrl?: string | null;
  kindLabel?: string | null;
};

function metaLine(hit: AffiliationPick): string {
  const place = [hit.city, hit.state].filter(Boolean).join(", ");
  return [place || null, hit.slug ? `/${hit.slug}` : null, hit.websiteUrl || null]
    .filter(Boolean)
    .join(" · ");
}

export type RunAffiliationDraft = {
  cityRunType: StaffCreateRunType;
  runClubId: string | null;
  runClubLabel: string | null;
  runClubPick: AffiliationPick | null;
  runBrandId: string | null;
  runBrandLabel: string | null;
  runBrandPick: AffiliationPick | null;
  runStoreId: string | null;
  runStoreLabel: string | null;
  runStorePick: AffiliationPick | null;
  raceRegistryId: string | null;
  partnerExtras: PartnerExtra[];
};

export const STAFF_RUN_TYPE_LABELS: Record<StaffCreateRunType, string> = {
  CLUB: "Club run",
  INDIVIDUAL: "Individual",
  RUN_STORE: "Run store",
  SPECIAL: "Special event",
  RACE_SHAKEOUT: "Race shakeout",
};

export const STAFF_RUN_TYPE_HINTS: Record<StaffCreateRunType, string> = {
  CLUB: "Bolt to a club container — pick the hosting club.",
  INDIVIDUAL: "Athlete-hosted — not staff create.",
  RUN_STORE: "Bolt to a store container.",
  SPECIAL: "Pop-up run event — floating or brand-led.",
  RACE_SHAKEOUT: "Bolt to a race container; brand is an optional stamp.",
};

/** @deprecated use STAFF_RUN_TYPE_LABELS */
const TYPE_LABELS = STAFF_RUN_TYPE_LABELS;
/** @deprecated use STAFF_RUN_TYPE_HINTS */
const TYPE_HINTS = STAFF_RUN_TYPE_HINTS;

export const RUN_MANAGE_TYPE_LABELS: Record<RunManageStaffCreateRunType, string> = {
  CLUB: STAFF_RUN_TYPE_LABELS.CLUB,
  RUN_STORE: STAFF_RUN_TYPE_LABELS.RUN_STORE,
  SPECIAL: STAFF_RUN_TYPE_LABELS.SPECIAL,
  RACE_SHAKEOUT: STAFF_RUN_TYPE_LABELS.RACE_SHAKEOUT,
};

export const RUN_MANAGE_TYPE_HINTS: Record<RunManageStaffCreateRunType, string> = {
  CLUB: STAFF_RUN_TYPE_HINTS.CLUB,
  RUN_STORE: STAFF_RUN_TYPE_HINTS.RUN_STORE,
  SPECIAL: STAFF_RUN_TYPE_HINTS.SPECIAL,
  RACE_SHAKEOUT: STAFF_RUN_TYPE_HINTS.RACE_SHAKEOUT,
};

type SearchKind = "club" | "brand" | "store";

type SearchStatus =
  | { kind: "searching" }
  | { kind: "empty"; q: string }
  | { kind: "error"; message: string };

function apiErrorMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e.response?.data?.error || e.message || "Search failed";
}

function HitCard({
  hit,
  actionLabel,
  onAction,
}: {
  hit: AffiliationPick;
  actionLabel: string;
  onAction: () => void;
}) {
  const line = metaLine(hit);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
      {hit.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hit.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded object-contain" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-500">
          {hit.name.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{hit.name}</p>
        {hit.kindLabel ? <p className="text-[11px] uppercase tracking-wide text-gray-500">{hit.kindLabel}</p> : null}
        {line ? <p className="truncate text-xs text-gray-600">{line}</p> : (
          <p className="text-xs text-gray-400">No city, slug, or site on this record</p>
        )}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="shrink-0 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function AttachedCard({ hit, onClear }: { hit: AffiliationPick; onClear: () => void }) {
  const line = metaLine(hit);
  return (
    <div className="mt-2 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
      {hit.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hit.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded object-contain" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white text-xs font-semibold text-emerald-800">
          {hit.name.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Attached</p>
        <p className="truncate text-sm font-semibold text-gray-900">{hit.name}</p>
        {line ? <p className="truncate text-xs text-gray-600">{line}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-xs font-medium text-gray-600 hover:text-gray-900"
      >
        Detach
      </button>
    </div>
  );
}

export function EntitySearch({
  label,
  placeholder,
  selected,
  onSelect,
  onClear,
  kind,
}: {
  label: string;
  placeholder: string;
  selected: AffiliationPick | null;
  onSelect: (hit: AffiliationPick) => void;
  onClear: () => void;
  kind: SearchKind;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AffiliationPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<SearchStatus | null>(null);

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setStatus({ kind: "searching" });
    setHits([]);
    try {
      if (kind === "brand") {
        const res = await runmanageApi.get(
          `/api/runmanage/brands/search?${new URLSearchParams({ q }).toString()}`
        );
        if (!res.data?.success) {
          setStatus({ kind: "error", message: res.data?.error ?? "Brand search failed" });
          return;
        }
        const brands = (res.data?.brands ?? []) as Array<{
          id: string;
          name: string;
          logoUrl?: string | null;
          slug?: string | null;
          websiteUrl?: string | null;
          brandType?: string | null;
          description?: string | null;
        }>;
        const mapped = brands.map((b) => ({
          id: b.id,
          name: b.name,
          logoUrl: b.logoUrl,
          slug: b.slug,
          websiteUrl: b.websiteUrl,
          kindLabel: b.brandType,
          secondary:
            (typeof b.description === "string" && b.description.trim()) || b.brandType || null,
        }));
        setHits(mapped);
        setStatus(mapped.length === 0 ? { kind: "empty", q } : null);
      } else if (kind === "club") {
        const res = await runmanageApi.get(
          `/api/runmanage/run-clubs/search?${new URLSearchParams({ q }).toString()}`
        );
        if (!res.data?.success) {
          setStatus({ kind: "error", message: res.data?.error ?? "Club search failed" });
          return;
        }
        const clubs = (res.data?.clubs ?? []) as Array<{
          id: string;
          name: string;
          logoUrl?: string | null;
          slug?: string | null;
          city?: string | null;
          state?: string | null;
          websiteUrl?: string | null;
        }>;
        const mapped = clubs.map((c) => ({
          id: c.id,
          name: c.name,
          logoUrl: c.logoUrl,
          slug: c.slug,
          city: c.city,
          state: c.state,
          websiteUrl: c.websiteUrl,
          secondary: c.city,
        }));
        setHits(mapped);
        setStatus(mapped.length === 0 ? { kind: "empty", q } : null);
      } else {
        const res = await runmanageApi.get(
          `/api/runmanage/run-stores/search?${new URLSearchParams({ q }).toString()}`
        );
        if (!res.data?.success) {
          setStatus({ kind: "error", message: res.data?.error ?? "Store search failed" });
          return;
        }
        const stores = (res.data?.stores ?? []) as Array<{
          id: string;
          name: string;
          logoUrl?: string | null;
          slug?: string | null;
          city?: string | null;
          state?: string | null;
          websiteUrl?: string | null;
        }>;
        const mapped = stores.map((s) => ({
          id: s.id,
          name: s.name,
          logoUrl: s.logoUrl,
          slug: s.slug,
          city: s.city,
          state: s.state,
          websiteUrl: s.websiteUrl,
          secondary: s.city,
        }));
        setHits(mapped);
        setStatus(mapped.length === 0 ? { kind: "empty", q } : null);
      }
    } catch (err) {
      setHits([]);
      setStatus({ kind: "error", message: apiErrorMessage(err) });
    } finally {
      setSearching(false);
    }
  }, [query, kind]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      {selected ? (
        <AttachedCard hit={selected} onClear={onClear} />
      ) : (
        <>
          <div className="mt-2 flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setStatus(null);
                setHits([]);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder={placeholder}
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={searching || query.trim().length < 2}
              onClick={() => void search()}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </button>
          </div>
          {status?.kind === "searching" ? (
            <p className="mt-2 text-sm text-gray-600">Searching the catalog…</p>
          ) : status?.kind === "empty" ? (
            <p className="mt-2 text-sm text-gray-600">No matches for &ldquo;{status.q}&rdquo;.</p>
          ) : status?.kind === "error" ? (
            <p className="mt-2 text-sm text-red-600">{status.message}</p>
          ) : hits.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">
              Search lists matches. Nothing is linked until you press Attach.
            </p>
          ) : null}
          {hits.length > 0 ? (
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {hits.map((h) => (
                <li key={h.id}>
                  <HitCard
                    hit={h}
                    actionLabel="Attach"
                    onAction={() => {
                      onSelect(h);
                      setHits([]);
                      setQuery("");
                      setStatus(null);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

export function emptyAffiliationDraft(
  cityRunType: StaffCreateRunType = "SPECIAL"
): RunAffiliationDraft {
  return {
    cityRunType,
    runClubId: null,
    runClubLabel: null,
    runClubPick: null,
    runBrandId: null,
    runBrandLabel: null,
    runBrandPick: null,
    runStoreId: null,
    runStoreLabel: null,
    runStorePick: null,
    raceRegistryId: null,
    partnerExtras: [],
  };
}

export function RunManageRunAffiliations({
  draft,
  onChange,
  showTypePicker = true,
  scopeMode = "default",
}: {
  draft: RunAffiliationDraft;
  onChange: (next: RunAffiliationDraft) => void;
  showTypePicker?: boolean;
  /** SPECIAL create: optional partner grid only (no primary type blocks). */
  scopeMode?: "default" | "special_partners_only";
}) {
  const open = runTypeHasOpenAffiliations(draft.cityRunType);
  const partnersOnly = scopeMode === "special_partners_only";

  const setType = (cityRunType: StaffCreateRunType) => {
    onChange({ ...emptyAffiliationDraft(cityRunType), cityRunType });
  };

  const addExtraClub = (hit: AffiliationPick) => {
    if (draft.partnerExtras.some((e) => e.kind === "CLUB" && e.refId === hit.id)) return;
    if (draft.runClubId === hit.id) return;
    onChange({
      ...draft,
      partnerExtras: [
        ...draft.partnerExtras,
        {
          kind: "CLUB",
          refId: hit.id,
          nameSnapshot: hit.name,
          logoUrlSnapshot: hit.logoUrl ?? null,
        },
      ],
    });
  };

  const removeExtra = (refId: string) => {
    onChange({
      ...draft,
      partnerExtras: draft.partnerExtras.filter((e) => e.refId !== refId),
    });
  };

  return (
    <div className="space-y-4">
      {showTypePicker ? (
        <div>
          <p className="text-sm font-semibold text-gray-900">What type of run is this?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {STAFF_CREATE_RUN_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  draft.cityRunType === t
                    ? "bg-sky-600 text-white"
                    : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-600">{TYPE_HINTS[draft.cityRunType]}</p>
        </div>
      ) : null}

      {!partnersOnly && draft.cityRunType === "CLUB" ? (
        <EntitySearch
          label="Club"
          placeholder="Search clubs…"
          kind="club"
          selected={draft.runClubPick}
          onSelect={(h) =>
            onChange({
              ...draft,
              runClubId: h.id,
              runClubLabel: h.name,
              runClubPick: h,
            })
          }
          onClear={() =>
            onChange({ ...draft, runClubId: null, runClubLabel: null, runClubPick: null })
          }
        />
      ) : null}

      {!partnersOnly && draft.cityRunType === "RUN_STORE" ? (
        <EntitySearch
          label="Run store"
          placeholder="Search stores…"
          kind="store"
          selected={draft.runStorePick}
          onSelect={(h) =>
            onChange({
              ...draft,
              runStoreId: h.id,
              runStoreLabel: h.name,
              runStorePick: h,
            })
          }
          onClear={() =>
            onChange({ ...draft, runStoreId: null, runStoreLabel: null, runStorePick: null })
          }
        />
      ) : null}

      {open && partnersOnly ? (
        <div>
          <p className="text-sm font-medium text-gray-800">Optional partner stamps</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <EntitySearch
              label="Store (optional)"
              placeholder="Search stores…"
              kind="store"
              selected={draft.runStorePick}
              onSelect={(h) =>
                onChange({
                  ...draft,
                  runStoreId: h.id,
                  runStoreLabel: h.name,
                  runStorePick: h,
                })
              }
              onClear={() =>
                onChange({ ...draft, runStoreId: null, runStoreLabel: null, runStorePick: null })
              }
            />
            <EntitySearch
              label="Club (optional)"
              placeholder="Search clubs…"
              kind="club"
              selected={draft.runClubPick}
              onSelect={(h) =>
                onChange({
                  ...draft,
                  runClubId: h.id,
                  runClubLabel: h.name,
                  runClubPick: h,
                })
              }
              onClear={() =>
                onChange({ ...draft, runClubId: null, runClubLabel: null, runClubPick: null })
              }
            />
          </div>
        </div>
      ) : null}

      {open && !partnersOnly ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <EntitySearch
            label="Brand (optional)"
            placeholder="Search brands…"
            kind="brand"
            selected={draft.runBrandPick}
            onSelect={(h) =>
              onChange({
                ...draft,
                runBrandId: h.id,
                runBrandLabel: h.name,
                runBrandPick: h,
              })
            }
            onClear={() =>
              onChange({ ...draft, runBrandId: null, runBrandLabel: null, runBrandPick: null })
            }
          />
          <EntitySearch
            label="Store (optional)"
            placeholder="Search stores…"
            kind="store"
            selected={draft.runStorePick}
            onSelect={(h) =>
              onChange({
                ...draft,
                runStoreId: h.id,
                runStoreLabel: h.name,
                runStorePick: h,
              })
            }
            onClear={() =>
              onChange({ ...draft, runStoreId: null, runStoreLabel: null, runStorePick: null })
            }
          />
          <EntitySearch
            label="Club (optional)"
            placeholder="Search clubs…"
            kind="club"
            selected={draft.runClubPick}
            onSelect={(h) =>
              onChange({
                ...draft,
                runClubId: h.id,
                runClubLabel: h.name,
                runClubPick: h,
              })
            }
            onClear={() =>
              onChange({ ...draft, runClubId: null, runClubLabel: null, runClubPick: null })
            }
          />
        </div>
      ) : null}

      {open ? (
        <div>
          <p className="text-sm font-medium text-gray-800">Additional clubs</p>
          <ExtraClubAdd onAdd={addExtraClub} />
          {draft.partnerExtras.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {draft.partnerExtras.map((e) => (
                <li
                  key={e.refId}
                  className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>{e.nameSnapshot}</span>
                  <button type="button" onClick={() => removeExtra(e.refId)} aria-label="Remove">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!partnersOnly && draft.cityRunType === "RACE_SHAKEOUT" ? (
        <label className="block text-sm">
          <span className="font-medium text-gray-700">Race registry id (optional)</span>
          <input
            type="text"
            value={draft.raceRegistryId ?? ""}
            onChange={(e) =>
              onChange({ ...draft, raceRegistryId: e.target.value.trim() || null })
            }
            className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      ) : null}
    </div>
  );
}

function ExtraClubAdd({ onAdd }: { onAdd: (hit: AffiliationPick) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AffiliationPick[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<SearchStatus | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setStatus({ kind: "searching" });
    setHits([]);
    try {
      const res = await runmanageApi.get(
        `/api/runmanage/run-clubs/search?${new URLSearchParams({ q }).toString()}`
      );
      if (!res.data?.success) {
        setStatus({ kind: "error", message: res.data?.error ?? "Club search failed" });
        return;
      }
      const clubs = (res.data?.clubs ?? []) as Array<{
        id: string;
        name: string;
        logoUrl?: string | null;
        slug?: string | null;
        city?: string | null;
        state?: string | null;
        websiteUrl?: string | null;
      }>;
      const mapped = clubs.map((c) => ({
        id: c.id,
        name: c.name,
        logoUrl: c.logoUrl,
        slug: c.slug,
        city: c.city,
        state: c.state,
        websiteUrl: c.websiteUrl,
        secondary: c.city,
      }));
      setHits(mapped);
      setStatus(mapped.length === 0 ? { kind: "empty", q } : null);
    } catch (err) {
      setHits([]);
      setStatus({ kind: "error", message: apiErrorMessage(err) });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setStatus(null);
            setHits([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Search another club…"
          className="min-w-[12rem] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={searching || query.trim().length < 2}
          onClick={() => void search()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>
      {status?.kind === "searching" ? (
        <p className="text-sm text-gray-600">Searching the catalog…</p>
      ) : status?.kind === "empty" ? (
        <p className="text-sm text-gray-600">No matches for &ldquo;{status.q}&rdquo;.</p>
      ) : status?.kind === "error" ? (
        <p className="text-sm text-red-600">{status.message}</p>
      ) : hits.length === 0 ? (
        <p className="text-xs text-gray-500">Search, then Attach. That adds the club to this run.</p>
      ) : null}
      <div className="space-y-2">
        {hits.map((h) => (
          <HitCard
            key={h.id}
            hit={h}
            actionLabel="Attach"
            onAction={() => {
              onAdd(h);
              setHits([]);
              setQuery("");
              setStatus(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

type RelationSnap = {
  id: string;
  name: string;
  logoUrl?: string | null;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  websiteUrl?: string | null;
  brandType?: string | null;
};

function pickFromRelation(rel: RelationSnap | null | undefined, fallbackId?: string | null): AffiliationPick | null {
  if (rel) {
    return {
      id: rel.id,
      name: rel.name,
      logoUrl: rel.logoUrl,
      slug: rel.slug,
      city: rel.city,
      state: rel.state,
      websiteUrl: rel.websiteUrl,
      kindLabel: rel.brandType,
    };
  }
  if (fallbackId) return { id: fallbackId, name: "Attached" };
  return null;
}

export function draftFromRun(run: {
  cityRunType?: string | null;
  runClubId?: string | null;
  runClub?: RelationSnap | null;
  runBrandId?: string | null;
  runBrand?: RelationSnap | null;
  runStoreId?: string | null;
  runStore?: RelationSnap | null;
  raceRegistryId?: string | null;
  partnerExtras?: unknown;
}): RunAffiliationDraft {
  const t = run.cityRunType;
  const cityRunType =
    typeof t === "string" && STAFF_CREATE_RUN_TYPES.includes(t as StaffCreateRunType)
      ? (t as StaffCreateRunType)
      : "SPECIAL";
  const runClubPick = pickFromRelation(run.runClub, run.runClubId);
  const runBrandPick = pickFromRelation(run.runBrand, run.runBrandId);
  const runStorePick = pickFromRelation(run.runStore, run.runStoreId);
  return {
    cityRunType,
    runClubId: runClubPick?.id ?? null,
    runClubLabel: run.runClub?.name ?? null,
    runClubPick,
    runBrandId: runBrandPick?.id ?? null,
    runBrandLabel: run.runBrand?.name ?? null,
    runBrandPick,
    runStoreId: runStorePick?.id ?? null,
    runStoreLabel: run.runStore?.name ?? null,
    runStorePick,
    raceRegistryId: run.raceRegistryId ?? null,
    partnerExtras: parsePartnerExtras(run.partnerExtras),
  };
}

export function affiliationsToPayload(draft: RunAffiliationDraft, athleteId?: string | null) {
  return {
    cityRunType: draft.cityRunType,
    runClubId: draft.runClubId,
    runBrandId: draft.runBrandId,
    runStoreId: draft.runStoreId,
    raceRegistryId: draft.raceRegistryId,
    partnerExtras: draft.partnerExtras.length > 0 ? draft.partnerExtras : null,
    athleteGeneratedId: draft.cityRunType === "INDIVIDUAL" ? athleteId ?? null : null,
  };
}
