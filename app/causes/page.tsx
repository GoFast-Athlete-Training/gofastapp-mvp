"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import api from "@/lib/api";
import { GOFAST_LINKS_PATH } from "@/lib/athlete/community-nav";

type Cause = {
  id: string;
  name: string;
  websiteUrl: string;
  logoUrl: string | null;
  note: string | null;
  raceRegistryId: string | null;
  createdAt: string;
  updatedAt: string;
};

type CharityHit = {
  charityId: string;
  charityName: string;
  charityUrl: string;
  charityLogo: string | null;
  athleteCauseId: string | null;
};

export default function AthleteCausesPage() {
  const [causes, setCauses] = useState<Cause[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<CharityHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("https://");
  const [manualLogo, setManualLogo] = useState("");
  const [manualNote, setManualNote] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get("/athlete/causes");
      if (!res.data?.success) throw new Error(res.data?.error || "Failed to load causes");
      setCauses(res.data.causes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCauses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = searchQ.trim();
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        setSearchError(null);
        try {
          const res = await api.get(
            `/athlete/links/charities${q ? `?q=${encodeURIComponent(q)}` : ""}`,
          );
          if (!res.data?.success) throw new Error(res.data?.error || "Search failed");
          if (!cancelled) setHits(res.data.charities ?? []);
        } catch (e) {
          if (!cancelled) {
            setHits([]);
            setSearchError(e instanceof Error ? e.message : "Search failed");
          }
        } finally {
          if (!cancelled) setSearchLoading(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQ]);

  async function addFromCatalog(hit: CharityHit) {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post("/athlete/causes", { charityId: hit.charityId });
      if (!res.data?.success) throw new Error(res.data?.error || "Failed to save");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    const name = manualName.trim();
    const url = manualUrl.trim();
    if (!name || !url) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post("/athlete/causes", {
        name,
        websiteUrl: url,
        logoUrl: manualLogo.trim() || undefined,
        note: manualNote.trim() || undefined,
      });
      if (!res.data?.success) throw new Error(res.data?.error || "Failed to save");
      setManualName("");
      setManualUrl("https://");
      setManualLogo("");
      setManualNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function removeCause(id: string) {
    if (!window.confirm("Remove this cause from your saved list?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.delete(`/athlete/causes/${id}`);
      if (!res.data?.success) throw new Error(res.data?.error || "Failed to delete");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AthleteAppShell>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Causes</h1>
            <p className="mt-1 text-sm text-gray-600">
              Save charities and donation links to reuse on your{" "}
              <Link href={GOFAST_LINKS_PATH} className="font-medium text-sky-700 hover:underline">
                Links
              </Link>{" "}
              page under a section heading.
            </p>
          </div>
        </div>

        {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Add manually</h2>
          <form className="mt-3 space-y-3" onSubmit={(e) => void addManual(e)}>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Cause name"
              required
            />
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://"
              required
            />
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={manualLogo}
              onChange={(e) => setManualLogo(e.target.value)}
              placeholder="Logo URL (optional)"
            />
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="Note (optional)"
              rows={2}
            />
            <button
              type="submit"
              disabled={saving || !manualName.trim() || !manualUrl.trim()}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save cause"}
            </button>
          </form>
        </section>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">GoFast charity catalog</h2>
          <p className="mt-1 text-xs text-gray-500">
            Browse charities synced from Race Manage. Filter by name — no need to claim a race.
          </p>
          <input
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search charity name"
          />
          {searchLoading ? <p className="mt-2 text-xs text-gray-500">Searching…</p> : null}
          {searchError ? <p className="mt-2 text-xs text-red-700">{searchError}</p> : null}
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {hits.map((h) => {
              const already = Boolean(h.athleteCauseId);
              return (
                <li
                  key={h.charityId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-2 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">{h.charityName}</span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">{h.charityUrl}</span>
                  </div>
                  <button
                    type="button"
                    disabled={saving || already}
                    onClick={() => void addFromCatalog(h)}
                    className="shrink-0 rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {already ? "Saved" : "Save"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Your causes</h2>
          {loading ? <p className="mt-2 text-sm text-gray-500">Loading…</p> : null}
          {!loading && causes.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No causes saved yet.</p>
          ) : null}
          <ul className="mt-3 divide-y divide-gray-100">
            {causes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <a
                    href={c.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-xs text-sky-700 hover:underline"
                  >
                    {c.websiteUrl}
                  </a>
                  {c.note ? <p className="mt-1 text-xs text-gray-600">{c.note}</p> : null}
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void removeCause(c.id)}
                  className="shrink-0 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AthleteAppShell>
  );
}
