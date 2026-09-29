"use client";

import { useCallback, useState } from "react";
import { Loader2, Store, Tag } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";

type PartnerKind = "none" | "store" | "brand";

type EntityHit = {
  type: string;
  id: string;
  name: string;
  secondary?: string | null;
  logoUrl?: string | null;
};

type PartnerDisplay = {
  kind: PartnerKind;
  id: string | null;
  name: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
};

function toExternalHref(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const t = url.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return `https://${t}`;
}

function compactUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 32);
  }
}

export function partnerFromRun(run: {
  runStore?: { id: string; name: string; websiteUrl?: string | null; logoUrl?: string | null } | null;
  runBrand?: { id: string; name: string; websiteUrl?: string | null; logoUrl?: string | null } | null;
  /** @deprecated use runBrand */
  partnerBrand?: { id: string; name: string; websiteUrl?: string | null; logoUrl?: string | null } | null;
}): PartnerDisplay {
  if (run.runStore?.id) {
    return {
      kind: "store",
      id: run.runStore.id,
      name: run.runStore.name,
      websiteUrl: run.runStore.websiteUrl ?? null,
      logoUrl: run.runStore.logoUrl ?? null,
    };
  }
  const brand = run.runBrand ?? run.partnerBrand;
  if (brand?.id) {
    return {
      kind: "brand",
      id: brand.id,
      name: brand.name,
      websiteUrl: brand.websiteUrl ?? null,
      logoUrl: brand.logoUrl ?? null,
    };
  }
  return { kind: "none", id: null, name: null, websiteUrl: null, logoUrl: null };
}

export default function CityRunPartnerPanel({
  runId,
  partner,
  onUpdated,
}: {
  runId: string;
  partner: PartnerDisplay;
  onUpdated: () => void | Promise<void>;
}) {
  const [kind, setKind] = useState<PartnerKind>(partner.kind === "none" ? "none" : partner.kind);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      if (kind === "brand") {
        const res = await runmanageApi.get(
          `/api/runmanage/brands/search?${new URLSearchParams({ q }).toString()}`,
        );
        const brands = (res.data?.brands ?? []) as Array<{
          id: string;
          name: string;
          slug?: string | null;
          logoUrl?: string | null;
        }>;
        setHits(
          brands.map((b) => ({
            type: "BRAND",
            id: b.id,
            name: b.name,
            secondary: b.slug ?? null,
            logoUrl: b.logoUrl ?? null,
          })),
        );
      } else {
        const res = await runmanageApi.get(`/api/acq/entity-search?${new URLSearchParams({ q }).toString()}`);
        const rows = (res.data?.results ?? []) as EntityHit[];
        setHits(Array.isArray(rows) ? rows.filter((r) => r.type === "RUN_STORE") : []);
      }
    } catch {
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, kind]);

  async function applyHit(hit: EntityHit) {
    setSaving(true);
    setError(null);
    try {
      if (kind === "store" && hit.type !== "RUN_STORE") {
        setError("Pick a run store");
        return;
      }
      if (kind === "brand" && hit.type !== "BRAND") {
        setError("Pick a brand");
        return;
      }

      if (kind === "store") {
        const push = await runmanageApi.post(`/api/acq-run-stores/${encodeURIComponent(hit.id)}/companypush`);
        if (!push.data?.success) {
          setError(push.data?.error ?? "Store sync failed");
          return;
        }
        const prodId = push.data.store?.id as string | undefined;
        await runmanageApi.put(`/api/runs/${runId}`, {
          runStoreId: prodId ?? hit.id,
          runBrandId: null,
        });
      } else if (kind === "brand") {
        await runmanageApi.put(`/api/runs/${runId}`, {
          runBrandId: hit.id,
          runStoreId: null,
        });
      }
      setHits([]);
      setQuery("");
      await onUpdated();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error ?? "Could not link partner");
    } finally {
      setSaving(false);
    }
  }

  async function clearPartner() {
    setSaving(true);
    setError(null);
    try {
      await runmanageApi.put(`/api/runs/${runId}`, { runStoreId: null, runBrandId: null });
      setKind("none");
      await onUpdated();
    } catch {
      setError("Could not clear partner");
    } finally {
      setSaving(false);
    }
  }

  const href = toExternalHref(partner.websiteUrl);

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Run partner</p>
      <p className="mt-1 text-xs text-gray-500">
        Optional store (e.g. Fleet Feet) or brand sponsor. Stores sync from ACQ; brands come from
        Sponsor Manage (prod snap).
      </p>

      {partner.kind !== "none" ? (
        <div className="mt-3 flex flex-wrap items-start gap-3 rounded-md border border-gray-200 bg-white px-3 py-3">
          {partner.logoUrl ? (
            <img
              src={partner.logoUrl}
              alt=""
              className="h-12 w-12 rounded border border-gray-200 object-contain"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100">
              {partner.kind === "store" ? (
                <Store className="h-5 w-5 text-gray-500" />
              ) : (
                <Tag className="h-5 w-5 text-gray-500" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-xs uppercase text-gray-500">{partner.kind}</p>
            <p className="font-medium text-gray-900">{partner.name}</p>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 hover:underline"
              >
                Website: {compactUrl(partner.websiteUrl)}
              </a>
            ) : (
              <span className="text-gray-400">Website missing</span>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void clearPartner()}
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["store", "brand"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setHits([]);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  kind === k
                    ? "border-sky-600 bg-sky-100 text-sky-950"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {k === "store" ? "Run store" : "Brand"}
              </button>
            ))}
          </div>
          {kind !== "none" ? (
            <>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  placeholder="Search ACQ library…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void search();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={searching}
                  onClick={() => void search()}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </button>
              </div>
              {hits.length > 0 ? (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2 text-sm">
                  {hits.map((h) => (
                    <li key={`${h.type}-${h.id}`}>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void applyHit(h)}
                        className="w-full rounded px-2 py-1.5 text-left hover:bg-sky-50"
                      >
                        <span className="font-medium">{h.name}</span>
                        {h.secondary ? (
                          <span className="text-gray-500"> · {h.secondary}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
