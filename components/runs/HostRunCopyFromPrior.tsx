"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import type { AthleteHostedRunInvite } from "@/lib/city-run/list-athlete-hosted-invites";

export default function HostRunCopyFromPrior() {
  const [invites, setInvites] = useState<AthleteHostedRunInvite[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<{ invites: AthleteHostedRunInvite[] }>(
          "/me/hosted-run-invites?limit=8",
        );
        setInvites(Array.isArray(data?.invites) ? data.invites : []);
      } catch {
        setInvites([]);
      }
    })();
  }, []);

  if (invites.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-semibold text-orange-700 hover:underline"
      >
        {open ? "Hide prior runs" : "Copy from a prior run"}
      </button>
      {open ? (
        <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
          {invites.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/host-a-run?fromRunId=${encodeURIComponent(inv.id)}`}
                className="block rounded-lg px-2 py-1.5 hover:bg-orange-50 text-gray-900"
              >
                {inv.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
