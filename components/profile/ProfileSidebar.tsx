"use client";

import { usePathname, useRouter } from "next/navigation";
import { User, Gauge, MapPin, Users, Pencil, Sparkles } from "lucide-react";

const items: { label: string; href: string; icon: typeof User }[] = [
  { label: "Overview", href: "/profile", icon: User },
  { label: "GoFast Page preview", href: "/profile/gofast-page", icon: Sparkles },
  { label: "Training & pace", href: "/profile/training", icon: Gauge },
  { label: "Findability", href: "/profile/discoverability", icon: MapPin },
  { label: "Community", href: "/profile/community", icon: Users },
  { label: "Edit all fields", href: "/athlete-edit-profile", icon: Pencil },
];

export default function ProfileSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <aside className="w-full sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-200 bg-white sm:bg-gray-50/80">
      <div className="p-3 sm:p-4 border-b border-gray-100 sm:border-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profile</p>
        <p className="text-sm text-gray-600 mt-0.5">Training, discovery, crews</p>
      </div>
      <nav className="flex flex-row sm:flex-col gap-1 p-2 overflow-x-auto sm:overflow-visible">
        {items.map(({ label, href, icon: Icon }) => {
          const isEditAll = href === "/athlete-edit-profile";
          const active = isEditAll
            ? false
            : href === "/profile"
              ? pathname === "/profile"
              : pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <button
              key={href}
              type="button"
              onClick={() => router.push(href)}
              className={`shrink-0 sm:w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                  : "text-gray-700 hover:bg-gray-100 border border-transparent"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-left">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
