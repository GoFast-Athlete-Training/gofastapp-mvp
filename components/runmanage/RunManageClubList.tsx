"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Loader2, Search } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import { runManageClubHubPath } from "@/lib/runmanage/paths";

type ClubRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  seriesCount: number;
};

export function RunManageClubList() {
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params = search.trim() ? new URLSearchParams({ q: search.trim() }) : "";
      const url = params ? `/api/runmanage/run-clubs?${params}` : "/api/runmanage/run-clubs";
      const res = await runmanageApi.get(url);
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
    void load("");
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clubs;
    return clubs.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.city ?? "").toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term)
    );
  }, [clubs, q]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">All clubs</p>
        <h1 className="text-2xl font-bold text-gray-900">Run hubs</h1>
        <p className="mt-1 text-sm text-gray-600">
          Open a club to see its series and build the next dated run from one place.
        </p>
      </div>

      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter clubs…"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
        />
      </label>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading clubs…
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No clubs with series found.</p>
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
    </div>
  );
}
