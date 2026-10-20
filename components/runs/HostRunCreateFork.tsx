"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { AthleteHostedRunInvite } from "@/lib/city-run/list-athlete-hosted-invites";

const cardClass =
  "rounded-xl border-2 border-orange-200 bg-orange-50 p-5 text-left hover:border-orange-400 w-full";

type Props = {
  onChooseNew: () => void;
  onChooseFromPrevious: (runId: string) => void;
};

export default function HostRunCreateFork({ onChooseNew, onChooseFromPrevious }: Props) {
  const [invites, setInvites] = useState<AthleteHostedRunInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [usedPickerOpen, setUsedPickerOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<{ invites: AthleteHostedRunInvite[] }>(
          "/me/hosted-run-invites",
        );
        setInvites(Array.isArray(data?.invites) ? data.invites : []);
      } catch {
        setInvites([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mb-8 space-y-4">
      <p className="text-sm font-semibold text-gray-900">How do you want to start?</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={onChooseNew} className={cardClass}>
          <p className="font-bold text-gray-900">New</p>
          <p className="mt-1 text-sm text-gray-600">Blank meetup and invite.</p>
        </button>
        <button
          type="button"
          onClick={() => setUsedPickerOpen(true)}
          className={`${cardClass} ${usedPickerOpen ? "border-orange-400 ring-2 ring-orange-200" : ""}`}
        >
          <p className="font-bold text-gray-900">Used</p>
          <p className="mt-1 text-sm text-gray-600">
            Copy title, description, time, and meetup from an earlier run.
          </p>
        </button>
      </div>

      {usedPickerOpen ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">Pick a prior run</p>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-gray-500">No prior runs yet — start with New.</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto space-y-1">
              {invites.map((inv) => (
                <li key={inv.id}>
                  <button
                    type="button"
                    onClick={() => onChooseFromPrevious(inv.id)}
                    className="w-full text-left rounded-lg px-2 py-2 text-sm hover:bg-orange-50 border border-transparent hover:border-orange-100"
                  >
                    <span className="font-medium text-gray-900">{inv.title}</span>
                    {!inv.isUpcoming ? (
                      <span className="ml-2 text-xs text-gray-400">Past</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
