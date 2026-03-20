"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";

type RaceRow = {
  id: string;
  name: string;
  raceDate: string;
  distanceMiles: number;
  raceType: string;
};

export default function TrainingSetupNewPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      router.replace("/welcome");
      return;
    }
    setReady(true);
  }, [router]);

  async function getToken() {
    const u = auth.currentUser;
    if (!u) throw new Error("Sign in required");
    return u.getIdToken();
  }

  async function searchRaces() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch("/api/race/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Search failed");
        setRaces([]);
        return;
      }
      setRaces(data.race_registry || []);
    } catch {
      setError("Search failed");
      setRaces([]);
    } finally {
      setSearching(false);
    }
  }

  async function createPlan() {
    if (!selectedRaceId || !startDate) {
      setError("Select a race and start date");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/training-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          raceRegistryId: selectedRaceId,
          startDate: new Date(startDate).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create plan");
        return;
      }
      router.push(`/training-setup/${data.plan.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Training plan setup</h1>
      <p className="text-slate-400 text-sm mb-6">
        Pick a race and when training starts. Preferences from your profile are
        snapshotted onto the plan.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Find race</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchRaces()}
            />
            <button
              type="button"
              onClick={searchRaces}
              disabled={searching}
              className="rounded bg-amber-500 text-slate-950 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
        </div>

        {races.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Select race</label>
            <select
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              value={selectedRaceId}
              onChange={(e) => setSelectedRaceId(e.target.value)}
            >
              <option value="">—</option>
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {new Date(r.raceDate).toLocaleDateString()} (
                  {r.raceType})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Plan start date</label>
          <input
            type="date"
            className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="button"
          onClick={createPlan}
          disabled={creating}
          className="w-full rounded bg-emerald-600 py-3 font-medium disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create plan"}
        </button>

        <Link href="/athlete-home" className="block text-center text-slate-500 text-sm">
          Cancel
        </Link>
      </div>
    </div>
  );
}
