"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  Activity,
  Bike,
  BookOpen,
  Home,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Trophy,
  Users,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  match?: (pathname: string | null) => boolean;
};

/** Plan execution + calendar + one-off build tooling lives here */
function planHubMatch(p: string | null): boolean {
  if (!p) return false;
  return (
    p === "/training" ||
    p.startsWith("/training-setup") ||
    p.startsWith("/training/day") ||
    p.startsWith("/build-a-run")
  );
}

/** Logged work, metrics, full workout log */
function performanceHubMatch(p: string | null): boolean {
  if (!p) return false;
  return p === "/performance" || p.startsWith("/performance/") || p.startsWith("/workouts");
}

function runCrewHubMatch(p: string | null): boolean {
  if (!p) return false;
  return (
    p === "/my-runcrews" ||
    p.startsWith("/runcrew-discovery") ||
    p.startsWith("/runcrew/")
  );
}

function triWorkMatch(p: string | null): boolean {
  return !!p && p.startsWith("/training/tri-work");
}

const navItems: NavItem[] = [
  { label: "Home", href: "/athlete-home", icon: Home },
  {
    label: "Plan",
    href: "/training",
    icon: LayoutDashboard,
    match: planHubMatch,
  },
  {
    label: "Performance",
    href: "/performance",
    icon: Activity,
    match: performanceHubMatch,
  },
  {
    label: "AI Coach",
    href: "/ask-coach",
    icon: MessageCircle,
    match: (path) => !!path && path.startsWith("/ask-coach"),
  },
  {
    label: "Run",
    href: "/gorun",
    icon: MapPin,
    match: (p) => !!p && (p === "/gorun" || p.startsWith("/gorun/")),
  },
  {
    label: "Run crews",
    href: "/my-runcrews",
    icon: Users,
    match: runCrewHubMatch,
  },
  {
    label: "Races",
    href: "/races",
    icon: Trophy,
    match: (p) =>
      !!p &&
      (p === "/races" || p.startsWith("/races/") || p.startsWith("/myrace/")),
  },
];

const toolItems: NavItem[] = [
  { label: "Journal", href: "/journal", icon: BookOpen },
  {
    // Single-user sandbox today; future: sport mode (runner vs tri) surfaces tri tooling in-app instead of a buried link.
    label: "TriWork",
    href: "/training/tri-work",
    icon: Bike,
    match: triWorkMatch,
  },
];

export default function AthleteSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r-2 border-gray-200 flex flex-col overflow-y-auto shrink-0">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <Image src="/logo.jpg" alt="GoFast" width={32} height={32} className="w-8 h-8 rounded-full" />
          <span className="text-lg font-bold text-gray-900">GoFast</span>
        </div>
        <p className="text-xs font-medium text-gray-700">Train for a goal</p>
        <p className="text-xs text-gray-500 mt-0.5">Execution-first dashboard</p>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const { label, href, icon: Icon, match } = item;
          const active = match
            ? match(pathname)
            : pathname === href ||
              (href !== "/athlete-home" && !!pathname?.startsWith(href));
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

      <div className="p-2 pt-0 border-t border-gray-100 mt-auto">
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Tools
        </p>
        <ul className="space-y-1">
          {toolItems.map((item) => {
            const { label, href, icon: Icon, match } = item;
            const active = match
              ? match(pathname)
              : pathname === href || !!pathname?.startsWith(href);
            return (
              <li key={href}>
                <button
                  type="button"
                  onClick={() => router.push(href)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  <span className="text-left">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
