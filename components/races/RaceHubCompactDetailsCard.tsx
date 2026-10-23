"use client";

import Link from "next/link";
import type { RaceHubDoorLink } from "@/components/races/RaceHubDoorNav";
import type { MembershipRow } from "@/components/races/race-hub-types";

const compactRowClass =
  "flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50";

function membershipHandleLine(memberships: MembershipRow[]): string {
  if (memberships.length === 0) return "Be the first one here.";
  const handles = memberships
    .map((m) => {
      const handle = m.Athlete.gofastHandle?.trim();
      return handle ? `@${handle.replace(/^@/, "")}` : null;
    })
    .filter(Boolean) as string[];
  if (handles.length === 0) {
    return `${memberships.length} runner${memberships.length === 1 ? "" : "s"} in this hub`;
  }
  return handles.join(", ");
}

type Props = {
  links: RaceHubDoorLink[];
  memberships: MembershipRow[];
};

export default function RaceHubCompactDetailsCard({ links, memberships }: Props) {
  const whosHereLine = membershipHandleLine(memberships);

  if (links.length === 0 && memberships.length === 0) {
    return (
      <p className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-center text-sm text-gray-600 shadow-sm">
        Prep links for this race are not published yet.
      </p>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100"
      aria-label="Race hub details"
    >
      {links.map((link) => {
        const row = (
          <>
            <span className="min-w-0 text-left">
              <span className="block">{link.label}</span>
              {link.detail ? (
                <span className="mt-0.5 block text-xs font-normal text-gray-500 truncate">
                  {link.detail}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-gray-400 font-normal" aria-hidden>
              →
            </span>
          </>
        );
        if (link.external) {
          return (
            <a
              key={`${link.label}-${link.href}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={compactRowClass}
            >
              {row}
            </a>
          );
        }
        return (
          <Link key={`${link.label}-${link.href}`} href={link.href} className={compactRowClass}>
            {row}
          </Link>
        );
      })}
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">Who&apos;s here</p>
        <p className="mt-0.5 text-xs text-gray-600 truncate">{whosHereLine}</p>
      </div>
    </section>
  );
}
