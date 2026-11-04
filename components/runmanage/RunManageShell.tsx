"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, LayoutGrid, PlusCircle } from "lucide-react";
import { useRunManageAuth } from "@/components/runmanage/RunManageProviders";
import { RUN_MANAGE_SERIES_PATH } from "@/lib/runmanage/paths";

const NAV_ITEMS = [
  { href: "/runmanage/runs", label: "This week", icon: LayoutGrid, match: (p: string | null) => p === "/runmanage/runs" || p === "/runmanage/runs/" },
  {
    href: RUN_MANAGE_SERIES_PATH,
    label: "Weekly slots",
    icon: CalendarDays,
    match: (p: string | null) =>
      p === RUN_MANAGE_SERIES_PATH ||
      p?.startsWith(`${RUN_MANAGE_SERIES_PATH}/`) ||
      p?.startsWith("/runmanage/clubs") ||
      false,
  },
  {
    href: "/runmanage/runs/new",
    label: "Create run",
    icon: PlusCircle,
    match: (p: string | null) => p?.startsWith("/runmanage/runs/new") ?? false,
  },
] as const;

function NavLinks({ pathname, className }: { pathname: string | null; className?: string }) {
  return (
    <nav className={className} aria-label="Run Manage">
      {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-sky-50 text-sky-800 border border-sky-200"
                : "text-gray-700 hover:bg-gray-100 border border-transparent"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function RunManageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, signOutRunManage } = useRunManageAuth();
  const isAuthSurface =
    pathname === "/runmanage/signin" ||
    pathname === "/runmanage/no-access" ||
    pathname === "/welcome-runmanage";

  if (isAuthSurface) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Link href="/runmanage/runs" className="text-lg font-semibold text-sky-700">
            Run Manage
          </Link>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {user?.email ? <span className="hidden sm:inline max-w-[200px] truncate">{user.email}</span> : null}
            <button
              type="button"
              onClick={() => void signOutRunManage()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="border-t border-gray-100 px-4 py-2 lg:hidden">
          <NavLinks pathname={pathname} className="flex gap-2 overflow-x-auto" />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-3">
          <NavLinks pathname={pathname} className="flex flex-col gap-1" />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
