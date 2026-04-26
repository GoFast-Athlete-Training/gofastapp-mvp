"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, ClipboardList, Home, Layers, List } from "lucide-react";

const items: { href: string; label: string; Icon: typeof Home; exact?: boolean }[] = [
  { href: "/training/tri-work", label: "Overview", Icon: Home, exact: true },
  { href: "/training/tri-work/bike", label: "Bike workouts", Icon: Bike },
  { href: "/training/tri-work/tri-sessions", label: "Tri sessions", Icon: Layers },
  { href: "/workouts/create", label: "Run workout builder", Icon: ClipboardList },
  { href: "/workouts", label: "My run workouts", Icon: List },
];

export default function TriWorkSubNav() {
  const pathname = usePathname();

  return (
    <nav
      className="w-52 shrink-0 border-r border-gray-200 bg-white py-4 px-2 hidden sm:block"
      aria-label="TriWork builders"
    >
      <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        TriWork
      </p>
      <ul className="space-y-0.5">
        {items.map(({ href, label, Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition",
                  active
                    ? "bg-orange-50 text-orange-900 ring-1 ring-orange-200"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="leading-snug">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="px-2 mt-4 text-[11px] text-gray-500 leading-snug">
        Swim builder and bricks on the calendar are next. Bike pushes to Garmin as CYCLING with
        power targets.
      </p>
    </nav>
  );
}

/** Horizontal chips on small screens */
export function TriWorkSubNavMobile() {
  const pathname = usePathname();
  return (
    <div className="sm:hidden flex flex-wrap gap-1.5 mb-4">
      {items.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              active ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
