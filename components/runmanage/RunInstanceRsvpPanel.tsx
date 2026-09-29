"use client";

import { Mail, MessageSquare, Users } from "lucide-react";
import type { Athlete, RSVP } from "@/components/runmanage/RunManageStaffEditor";

type Props = {
  rsvps?: RSVP[];
  runTitle: string;
};

function athleteName(athlete: Athlete): string {
  const parts = [athlete.firstName, athlete.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unknown athlete";
}

function RsvpList({ title, items }: { title: string; items: RSVP[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
      <ul className="space-y-2">
        {items.map((rsvp) => (
          <li
            key={rsvp.id}
            className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-800"
          >
            <p className="font-medium">{athleteName(rsvp.Athlete)}</p>
            {rsvp.Athlete.email ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600">
                <Mail className="h-3 w-3 shrink-0" />
                {rsvp.Athlete.email}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RunInstanceRsvpPanel({ rsvps, runTitle }: Props) {
  const going =
    rsvps?.filter((r) => r.status === "going" || r.status === "GOING") ?? [];
  const maybe =
    rsvps?.filter((r) => r.status === "maybe" || r.status === "MAYBE") ?? [];
  const total = rsvps?.length ?? 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Users className="h-5 w-5" />
            Manage RSVPs
          </h2>
          <p className="mt-1 text-sm text-gray-600">{runTitle}</p>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-900">
          {total} total
        </span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-gray-500">No RSVPs yet for this run.</p>
      ) : (
        <>
          <RsvpList title={`Going (${going.length})`} items={going} />
          <RsvpList title={`Maybe (${maybe.length})`} items={maybe} />
        </>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          Coming soon
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Message attendees, export RSVP list, and check-in tools will live here.
        </p>
      </div>
    </div>
  );
}
