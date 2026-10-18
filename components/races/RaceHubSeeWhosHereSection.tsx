"use client";

import type { MembershipRow } from "@/components/races/race-hub-types";

function Avatar({
  photoURL,
  handle,
}: {
  photoURL?: string | null;
  handle?: string | null;
}) {
  const initial = (handle?.replace(/^@/, "")[0] || "R").toUpperCase();
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full border-2 border-white object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-orange-400 to-orange-600 text-xs font-semibold text-white">
      {initial}
    </div>
  );
}

function PublicPersonRow({ member }: { member: MembershipRow }) {
  const handle = member.Athlete.gofastHandle?.trim();
  const label = handle ? `@${handle.replace(/^@/, "")}` : "Runner";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2">
      <Avatar photoURL={member.Athlete.photoURL} handle={handle} />
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </div>
  );
}

type Props = {
  memberships: MembershipRow[];
};

export default function RaceHubSeeWhosHereSection({ memberships }: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">See who&apos;s here</h2>
        {memberships.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">Be the first one here.</p>
        ) : (
          <p className="mt-1 text-sm text-gray-500">
            {memberships.length} runner{memberships.length === 1 ? "" : "s"} in this hub
          </p>
        )}
      </div>
      {memberships.length > 0 ? (
        <div className="space-y-2">
          {memberships.map((m) => (
            <PublicPersonRow key={m.id} member={m} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
