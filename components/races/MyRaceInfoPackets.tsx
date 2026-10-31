"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { RaceInfoPacketsResponse } from "@/lib/races/race-info-packet-types";

type Props = {
  raceRegistryId: string;
};

export function MyRaceInfoPackets({ raceRegistryId }: Props) {
  const [data, setData] = useState<RaceInfoPacketsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/race-registry/${raceRegistryId}/info-packets`);
        if (!cancelled && res.data?.success) {
          setData(res.data as RaceInfoPacketsResponse);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raceRegistryId]);

  if (loading) {
    return (
      <p className="text-sm text-gray-500">Loading race prep for your timeline…</p>
    );
  }
  if (!data || data.packets.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Prep for race day</h2>
        <span className="text-xs font-medium uppercase tracking-wide text-sky-700">
          {data.lifecyclePhase.replace(/([A-Z])/g, " $1").trim()}
        </span>
      </div>
      <ul className="space-y-3">
        {data.packets.map((packet) => (
          <li
            key={packet.kind}
            className={`rounded-lg border p-3 ${
              packet.emphasized
                ? "border-sky-200 bg-sky-50"
                : "border-gray-100 bg-gray-50"
            }`}
          >
            <p className="font-medium text-gray-900">{packet.title}</p>
            {packet.summary ? (
              <p className="mt-1 text-sm text-gray-600">{packet.summary}</p>
            ) : null}
            {packet.registrationUrl ? (
              <Link
                href={packet.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-sky-700 hover:underline"
              >
                Register with organizer
              </Link>
            ) : null}
            {packet.items.length > 0 ? (
              <dl className="mt-2 space-y-1 text-sm text-gray-700">
                {packet.items.slice(0, 4).map((item) => (
                  <div key={`${item.label}-${item.value}`}>
                    <dt className="inline font-medium text-gray-800">{item.label}: </dt>
                    <dd className="inline">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
