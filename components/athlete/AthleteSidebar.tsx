"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Activity, LayoutDashboard, MapPin, PenLine, Trophy, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AthleteMobileNav from "@/components/athlete/AthleteMobileNav";
import {
  BUILD_CONTENT_LABEL,
  BUILD_CONTENT_PATH,
  COMMUNITY_HUB_PATH,
  MANAGE_COMMUNITY_LABEL,
  isCommunityHubPath,
  isContentStudioPath,
} from "@/lib/athlete/community-nav";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match?: (pathname: string | null) => boolean;
};

/** Training hub: schedule, setup, tri-work sandbox, day detail */
function planHubMatch(p: string | null): boolean {
  if (!p) return false;
  return (
    p === "/training" ||
    p.startsWith("/training/") ||
    p.startsWith("/training-setup")
  );
}

function activityHubMatch(p: string | null): boolean {
  if (!p) return false;
  if (p === "/workouts/create" || p.startsWith("/workouts/create/")) return false;
  return (
    p === "/activities" ||
    p.startsWith("/activities/") ||
    p === "/workouts" ||
    (p.startsWith("/workouts/") && !p.startsWith("/workouts/create"))
  );
}

function gorunMatch(p: string | null): boolean {
  if (!p) return false;
  if (p === "/gorun") return true;
  if (p.startsWith("/gorun/")) return true;
  return (
    p === "/build-a-run" ||
    p === "/host-a-run" ||
    p === "/workouts/create" ||
    p.startsWith("/workouts/create/")
  );
}

const primaryNavItems: NavItem[] = [
  {
    label: "Train",
    href: "/training",
    icon: LayoutDashboard,
    match: planHubMatch,
  },
  {
    label: "Run",
    href: "/build-a-run",
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
    label: "Activity",
    href: "/activities",
    icon: Activity,
    match: activityHubMatch,
  },
];

function AthleteSidebarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const contentStudioActive = isContentStudioPath(pathname);
  const hubActive = isCommunityHubPath(pathname);

  return (
    <>
      {/* Desktop rail — hidden on mobile so content can use full width */}
      <aside className="hidden lg:flex w-64 bg-white border-r-2 border-gray-200 flex-col overflow-y-auto shrink-0">
        <div className="p-4 border-b border-gray-200">
          <Link
            href="/athlete-home"
            className="flex items-center gap-3 mb-2 rounded-md outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <Image
              src="/logo.jpg"
              alt="GoFast"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-contain"
            />
            <span className="text-lg font-bold text-gray-900">GoFast</span>
          </Link>
          <p className="text-xs font-medium text-gray-700">Train for a goal</p>
          <p className="text-xs text-gray-500 mt-0.5">Your goal and training schedule</p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto flex flex-col" aria-label="Primary">
          <div className="space-y-1">
            {primaryNavItems.map((item) => {
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
          </div>

          <div className="pt-3 mt-2 border-t border-gray-200 space-y-1">
            <button
              type="button"
              onClick={() => router.push(BUILD_CONTENT_PATH)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                contentStudioActive
                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <PenLine className="h-5 w-5 shrink-0" />
              <span className="text-left">{BUILD_CONTENT_LABEL}</span>
            </button>
          </div>

          <div className="mt-auto pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push(COMMUNITY_HUB_PATH)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                hubActive
                  ? "bg-sky-100 text-sky-900 border border-sky-300 shadow-sm"
                  : "text-gray-700 hover:bg-gray-100 border border-transparent"
              }`}
            >
              <Users className="h-5 w-5 shrink-0" />
              <span className="text-left">{MANAGE_COMMUNITY_LABEL}</span>
            </button>
            {contentStudioActive && !hubActive ? (
              <p className="px-3 pt-2 text-[11px] text-gray-500 leading-snug">
                Host runs from <span className="font-medium">Run</span>; logged work under{" "}
                <span className="font-medium">Activity</span>.
              </p>
            ) : null}
          </div>
        </nav>
      </aside>

      <AthleteMobileNav />
    </>
  );
}

export default function AthleteSidebar() {
  return (
    <Suspense fallback={null}>
      <AthleteSidebarInner />
    </Suspense>
  );
}
