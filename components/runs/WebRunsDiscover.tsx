"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { isAxiosError } from "axios";
import DiscoverRunCard, { type DiscoverRunCardRun } from "@/components/runs/DiscoverRunCard";

type DiscoveryRun = DiscoverRunCardRun & {
  citySlug: string;
  published?: boolean;
};

export default function WebRunsDiscover() {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingCity, setMissingCity] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissingCity(false);
    try {
      const runsRes = await api.get<{ success?: boolean; runs?: DiscoveryRun[] }>("/runs/discovery");
      setRuns(Array.isArray(runsRes.data?.runs) ? runsRes.data.runs : []);
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 400) {
        const body = e.response.data as { code?: string; error?: string };
        if (body?.code === "missing_athlete_city") {
          setMissingCity(true);
          setRuns([]);
          setError(null);
          setLoading(false);
          return;
        }
        setError(typeof body?.error === "string" ? body.error : "Could not load runs.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load discover runs");
      }
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm text-gray-600">
          See runs happening in your area.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Don&apos;t see your area? Make sure you set your city in your{" "}
          <Link href="/settings" className="font-medium text-sky-700 hover:underline">
            profile
          </Link>
          .
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading runs…</p>
      ) : missingCity ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center space-y-3">
          <p className="text-gray-700 font-medium">Add your city to find runs near you</p>
          <p className="text-sm text-gray-500">
            We use your profile city to show your metro area without loading every city in the country.
          </p>
          <Link
            href="/settings"
            className="inline-flex rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Update profile
          </Link>
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 py-4">{error}</p>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center space-y-3">
          <p className="text-sm text-gray-600">
            Still don&apos;t see anything?{" "}
            <Link href="/host-a-run" className="font-semibold text-orange-700 hover:underline">
              Build a run here
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <DiscoverRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}
