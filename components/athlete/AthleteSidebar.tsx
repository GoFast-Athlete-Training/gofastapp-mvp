"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { Home, LayoutDashboard, MapPin, Trophy, User } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home;
  match?: (pathname: string | null) => boolean;
};

function trainingHubMatch(p: string | null): boolean {
  if (!p) return false;
  return (
    p === "/training" ||
    p.startsWith("/training-setup") ||
    p.startsWith("/training/day") ||
    p.startsWith("/workouts") ||
    p.startsWith("/journal") ||
    p.startsWith("/ask-coach") ||
    p.startsWith("/my-runcrews") ||
    p.startsWith("/build-a-run")
  );
}

const navItems: NavItem[] = [
  { label: "Home", href: "/athlete-home", icon: Home },
  {
    label: "Train",
    href: "/training",
    icon: LayoutDashboard,
    match: trainingHubMatch,
  },
  {
    label: "Run",
    href: "/gorun",
    icon: MapPin,
    match: (p) => !!p && (p === "/gorun" || p.startsWith("/gorun/")),
  },
  { label: "Races", href: "/races", icon: Trophy },
  {
    label: "Profile",
    href: "/profile",
    icon: User,
    match: (p) => !!p && p.startsWith("/profile"),
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
    </aside>
  );
}
