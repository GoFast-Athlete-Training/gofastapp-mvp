"use client";

import Link from "next/link";

export type RaceHubDoorLink = {
  label: string;
  href: string;
  detail?: string | null;
  external?: boolean;
};

const rowClassName =
  "flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50";

type Props = {
  links: RaceHubDoorLink[];
};

export default function RaceHubDoorNav({ links }: Props) {
  if (links.length === 0) {
    return (
      <p className="rounded-xl bg-white p-4 text-center text-sm text-gray-600 ring-1 ring-gray-200">
        Prep links for this race are not published yet.
      </p>
    );
  }

  return (
    <nav className="space-y-3" aria-label="Race hub">
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
            <span className="shrink-0 text-gray-400" aria-hidden>
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
              className={rowClassName}
            >
              {row}
            </a>
          );
        }
        return (
          <Link key={`${link.label}-${link.href}`} href={link.href} className={rowClassName}>
            {row}
          </Link>
        );
      })}
    </nav>
  );
}
