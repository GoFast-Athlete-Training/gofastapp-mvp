"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { Home, Target, Dumbbell, Users, Trophy, User, MessageCircle, BookOpen } from "lucide-react";

const navItems: { label: string; href: string; icon: typeof Home }[] = [
  { label: "Home", href: "/athlete-home", icon: Home },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Training", href: "/training", icon: Dumbbell },
  { label: "Training Pod", href: "/my-runcrews", icon: Users },
  { label: "Races", href: "/races", icon: Trophy },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Ask a Coach", href: "/ask-coach", icon: MessageCircle },
  { label: "Training Journal", href: "/journal", icon: BookOpen },
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
        {navItems.map(({ label, href, icon: Icon }) => {
          const active =
            href === "/training"
              ? pathname === "/training" ||
                pathname?.startsWith("/workouts") ||
                pathname?.startsWith("/training-setup")
              : pathname === href || (href !== "/athlete-home" && pathname?.startsWith(href));
          return (
            <button
              key={href}
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
