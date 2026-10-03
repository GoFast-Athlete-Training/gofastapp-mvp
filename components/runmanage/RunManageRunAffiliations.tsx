"use client";

import { useCallback, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  type PartnerExtra,
  type StaffCreateRunType,
  STAFF_CREATE_RUN_TYPES,
  runTypeHasOpenAffiliations,
  parsePartnerExtras,
} from "@/lib/runmanage/partner-extras";

export type AffiliationPick = {
  id: string;
  name: string;
  logoUrl?: string | null;
  secondary?: string | null;
};

export type RunAffiliationDraft = {
  cityRunType: StaffCreateRunType;
  runClubId: string | null;
  runClubLabel: string | null;
  runBrandId: string | null;
  runBrandLabel: string | null;
  runStoreId: string | null;
  runStoreLabel: string | null;
  raceRegistryId: string | null;
  partnerExtras: PartnerExtra[];
};

const TYPE_LABELS: Record<StaffCreateRunType, string> = {
  CLUB: "Club run",
  INDIVIDUAL: "Individual",
  RUN_STORE: "Run store",
  SPECIAL: "Special",
  RACE_SHAKEOUT: "Shakeout",
};

const TYPE_HINTS: Record<StaffCreateRunType, string> = {
  CLUB: "Pick the hosting club.",
  INDIVIDUAL: "Athlete-hosted run.",
  RUN_STORE: "Store-hosted (e.g. Fleet Feet Tuesday run).",
  SPECIAL: "Brand, store, and club are all optional.",
  RACE_SHAKEOUT: "Race shakeout — brand, store, and club are all optional.",
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

function EntitySearch({
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
        const brands = (res.data?.brands ?? []) as AffiliationPick[];
        const mapped = brands.map((b) => ({
          id: b.id,
          name: b.name,
          logoUrl: b.logoUrl,
          secondary: null as string | null,
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
          city?: string | null;
        }>;
        const mapped = clubs.map((c) => ({
          id: c.id,
          name: c.name,
          logoUrl: c.logoUrl,
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
          city?: string | null;
        }>;
        const mapped = stores.map((s) => ({
          id: s.id,
          name: s.name,
          logoUrl: s.logoUrl,
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
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        {selected ? (
          <button type="button" onClick={onClear} className="text-xs text-gray-500 hover:text-gray-800">
            Clear
          </button>
        ) : null}
      </div>
      {selected ? (
        <p className="mt-2 text-sm font-semibold text-gray-900">{selected.name}</p>
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
            <p className="mt-2 text-sm text-gray-600">Searching…</p>
          ) : status?.kind === "empty" ? (
            <p className="mt-2 text-sm text-gray-600">No matches for &ldquo;{status.q}&rdquo;.</p>
          ) : status?.kind === "error" ? (
            <p className="mt-2 text-sm text-red-600">{status.message}</p>
          ) : null}
          {hits.length > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto divide-y divide-gray-100 rounded border border-gray-100">
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(h);
                      setHits([]);
                      setQuery("");
                      setStatus(null);
                    }}
                    className="w-full px-2 py-2 text-left text-sm hover:bg-sky-50"
                  >
                    <span className="font-medium">{h.name}</span>
                    {h.secondary ? (
                      <span className="ml-1 text-xs text-gray-500">{h.secondary}</span>
                    ) : null}
                  </button>
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
    runBrandId: null,
    runBrandLabel: null,
    runStoreId: null,
    runStoreLabel: null,
    raceRegistryId: null,
    partnerExtras: [],
  };
}

export function RunManageRunAffiliations({
  draft,
  onChange,
  showTypePicker = true,
}: {
  draft: RunAffiliationDraft;
  onChange: (next: RunAffiliationDraft) => void;
  showTypePicker?: boolean;
}) {
  const open = runTypeHasOpenAffiliations(draft.cityRunType);

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

      {draft.cityRunType === "CLUB" ? (
        <EntitySearch
          label="Club"
          placeholder="Search clubs…"
          kind="club"
          selected={
            draft.runClubId && draft.runClubLabel
              ? { id: draft.runClubId, name: draft.runClubLabel }
              : null
          }
          onSelect={(h) =>
            onChange({
              ...draft,
              runClubId: h.id,
              runClubLabel: h.name,
            })
          }
          onClear={() => onChange({ ...draft, runClubId: null, runClubLabel: null })}
        />
      ) : null}

      {draft.cityRunType === "RUN_STORE" ? (
        <EntitySearch
          label="Run store"
          placeholder="Search stores…"
          kind="store"
          selected={
            draft.runStoreId && draft.runStoreLabel
              ? { id: draft.runStoreId, name: draft.runStoreLabel }
              : null
          }
          onSelect={(h) =>
            onChange({
              ...draft,
              runStoreId: h.id,
              runStoreLabel: h.name,
            })
          }
          onClear={() => onChange({ ...draft, runStoreId: null, runStoreLabel: null })}
        />
      ) : null}

      {open ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <EntitySearch
            label="Brand (optional)"
            placeholder="Search brands…"
            kind="brand"
            selected={
              draft.runBrandId && draft.runBrandLabel
                ? { id: draft.runBrandId, name: draft.runBrandLabel }
                : null
            }
            onSelect={(h) =>
              onChange({ ...draft, runBrandId: h.id, runBrandLabel: h.name })
            }
            onClear={() => onChange({ ...draft, runBrandId: null, runBrandLabel: null })}
          />
          <EntitySearch
            label="Store (optional)"
            placeholder="Search stores…"
            kind="store"
            selected={
              draft.runStoreId && draft.runStoreLabel
                ? { id: draft.runStoreId, name: draft.runStoreLabel }
                : null
            }
            onSelect={(h) =>
              onChange({ ...draft, runStoreId: h.id, runStoreLabel: h.name })
            }
            onClear={() => onChange({ ...draft, runStoreId: null, runStoreLabel: null })}
          />
          <EntitySearch
            label="Club (optional)"
            placeholder="Search clubs…"
            kind="club"
            selected={
              draft.runClubId && draft.runClubLabel
                ? { id: draft.runClubId, name: draft.runClubLabel }
                : null
            }
            onSelect={(h) =>
              onChange({ ...draft, runClubId: h.id, runClubLabel: h.name })
            }
            onClear={() => onChange({ ...draft, runClubId: null, runClubLabel: null })}
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

      {draft.cityRunType === "RACE_SHAKEOUT" ? (
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
      const clubs = (res.data?.clubs ?? []) as Array<{ id: string; name: string; city?: string | null }>;
      const mapped = clubs.map((c) => ({ id: c.id, name: c.name, secondary: c.city }));
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
        <p className="text-sm text-gray-600">Searching…</p>
      ) : status?.kind === "empty" ? (
        <p className="text-sm text-gray-600">No matches for &ldquo;{status.q}&rdquo;.</p>
      ) : status?.kind === "error" ? (
        <p className="text-sm text-red-600">{status.message}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {hits.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => {
              onAdd(h);
              setHits([]);
              setQuery("");
              setStatus(null);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800"
          >
            <Plus className="h-3 w-3" />
            {h.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function draftFromRun(run: {
  cityRunType?: string | null;
  runClubId?: string | null;
  runClub?: { id: string; name: string } | null;
  runBrandId?: string | null;
  runBrand?: { id: string; name: string } | null;
  runStoreId?: string | null;
  runStore?: { id: string; name: string } | null;
  raceRegistryId?: string | null;
  partnerExtras?: unknown;
}): RunAffiliationDraft {
  const t = run.cityRunType;
  const cityRunType =
    typeof t === "string" && STAFF_CREATE_RUN_TYPES.includes(t as StaffCreateRunType)
      ? (t as StaffCreateRunType)
      : "SPECIAL";
  return {
    cityRunType,
    runClubId: run.runClubId ?? run.runClub?.id ?? null,
    runClubLabel: run.runClub?.name ?? null,
    runBrandId: run.runBrandId ?? run.runBrand?.id ?? null,
    runBrandLabel: run.runBrand?.name ?? null,
    runStoreId: run.runStoreId ?? run.runStore?.id ?? null,
    runStoreLabel: run.runStore?.name ?? null,
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
