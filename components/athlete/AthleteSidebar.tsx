"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Activity, LayoutDashboard, MapPin, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match?: (pathname: string | null) => boolean;
};

/** Training hub: schedule, setup, tri-work sandbox, day detail, build-a-run */
function planHubMatch(p: string | null): boolean {
  if (!p) return false;
  return (
    p === "/training" ||
    p.startsWith("/training/") ||
    p.startsWith("/training-setup") ||
    p.startsWith("/build-a-run")
  );
}

/** Logged work, metrics, full workout log */
function performanceHubMatch(p: string | null): boolean {
  if (!p) return false;
  return p === "/performance" || p.startsWith("/performance/");
}

function gorunMatch(p: string | null): boolean {
  return !!p && (p === "/gorun" || p.startsWith("/gorun/"));
}

const navItems: NavItem[] = [
  {
    label: "Train",
    href: "/training",
    icon: LayoutDashboard,
    match: planHubMatch,
  },
  {
    label: "Run",
    href: "/gorun",
    icon: MapPin,
    match: gorunMatch,
  },
  {
    label: "Races",
    href: "/races",
    icon: Trophy,
    match: (path) =>
      !!path &&
      (path === "/races" || path.startsWith("/races/") || path.startsWith("/myrace/")),
  },
  {
    label: "Performance",
    href: "/performance",
    icon: Activity,
    match: performanceHubMatch,
  },
];

export default function AthleteSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r-2 border-gray-200 flex flex-col overflow-y-auto shrink-0">
      <div className="p-4 border-b border-gray-200">
        <Link href="/athlete-home" className="flex items-center gap-3 mb-2 rounded-md outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
          <Image src="/logo.jpg" alt="GoFast" width={32} height={32} className="w-8 h-8 rounded-full" />
          <span className="text-lg font-bold text-gray-900">GoFast</span>
        </Link>
        <p className="text-xs font-medium text-gray-700">Train for a goal</p>
        <p className="text-xs text-gray-500 mt-0.5">Your goal and training schedule</p>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Primary">
        {navItems.map((item) => {
          const { label, href, icon: Icon, match } = item;
          const active = match
            ? match(pathname)
            : pathname === href || !!pathname?.startsWith(`${href}/`);
          return (
            <button
              key={`${href}-${label}`}
              type="button"
              onClick={() => router.push(href)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-left">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
