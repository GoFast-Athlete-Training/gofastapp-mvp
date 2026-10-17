"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Search } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import {
  buildClubScopeOptions,
  clubMatchesScope,
  type ClubScopeKey,
} from "@/lib/runmanage/club-scope";
import { runManageClubHubPath } from "@/lib/runmanage/paths";

type ClubRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  citySlug: string | null;
  state: string | null;
  seriesCount: number;
};

export function RunManageClubList() {
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [scopeKey, setScopeKey] = useState<ClubScopeKey | "">("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await runmanageApi.get("/api/runmanage/run-clubs");
      if (res.data?.success) {
        setClubs(res.data.clubs ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scopeOptions = useMemo(() => buildClubScopeOptions(clubs), [clubs]);

  const scopedClubs = useMemo(() => {
    if (!scopeKey) return [];
    return clubs.filter((c) => clubMatchesScope(c, scopeKey));
  }, [clubs, scopeKey]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return scopedClubs;
    return scopedClubs.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.city ?? "").toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term)
    );
  }, [scopedClubs, q]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Build by clubs</p>
        <h1 className="text-2xl font-bold text-gray-900">City or region</h1>
        <p className="mt-1 text-sm text-gray-600">
          Pick where you operate, then open a club hub to build from its series.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : scopeOptions.length === 0 ? (
        <p className="text-sm text-gray-500">No clubs with series found.</p>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Scope</p>
            <div className="flex flex-wrap gap-2">
              {scopeOptions.map((opt) => {
                const active = scopeKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setScopeKey(opt.key);
                      setQ("");
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                    {opt.kind === "region" ? (
                      <span className={active ? "text-sky-100" : "text-gray-500"}> · region</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {scopeKey ? (
            <>
              <label className="relative block max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search clubs in this scope…"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
                />
              </label>

              {filtered.length === 0 ? (
                <p className="text-sm text-gray-500">No clubs match in this scope.</p>
              ) : (
                <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {filtered.map((club) => (
                    <li key={club.id}>
                      <Link
                        href={runManageClubHubPath(club.id)}
                        className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 sm:px-5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">{club.name}</p>
                          <p className="text-sm text-gray-600">
                            {[club.city, club.state].filter(Boolean).join(", ") || club.slug}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-gray-500">
                          {club.seriesCount} series
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-600">
              Select a city or region to see clubs.
            </p>
          )}
        </>
      )}
    </div>
  );
}
