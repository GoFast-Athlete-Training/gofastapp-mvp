"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { CalendarDays, LayoutGrid, ListChecks, PlusCircle } from "lucide-react";
import { useRunManageAuth } from "@/components/runmanage/RunManageProviders";
import {
  RUN_MANAGE_DASHBOARD_PATH,
  RUN_MANAGE_SERIES_PATH,
  RUN_MANAGE_THIS_WEEK_PATH,
} from "@/lib/runmanage/paths";
import { RunManageScopeBar } from "@/components/runmanage/RunManageScopeBar";
import { appendScopeToPath, scopeFromSearchParams } from "@/lib/runmanage/scope-query";

const NAV_ITEMS = [
  {
    href: RUN_MANAGE_DASHBOARD_PATH,
    label: "Dashboard",
    icon: LayoutGrid,
    match: (p: string | null) => p === "/runmanage/runs" || p === "/runmanage/runs/",
  },
  {
    href: RUN_MANAGE_THIS_WEEK_PATH,
    label: "Manage this week's runs",
    icon: ListChecks,
    match: (p: string | null) => p === "/runmanage/this-week" || p?.startsWith("/runmanage/this-week/"),
  },
  {
    href: RUN_MANAGE_SERIES_PATH,
    label: "Manage series",
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

function showScopeBarForPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/runmanage/runs" || pathname === "/runmanage/runs/") return false;
  if (pathname === "/runmanage/this-week" || pathname.startsWith("/runmanage/this-week/")) return false;
  if (pathname.startsWith("/runmanage/runs/") && !pathname.startsWith("/runmanage/runs/new")) return false;
  return (
    pathname.startsWith("/runmanage/series") ||
    pathname.startsWith("/runmanage/clubs") ||
    pathname.startsWith("/runmanage/types") ||
    pathname.startsWith("/runmanage/all-runs")
  );
}

function NavLinks({
  pathname,
  className,
  scopeHref,
}: {
  pathname: string | null;
  className?: string;
  scopeHref: (path: string) => string;
}) {
  return (
    <nav className={className} aria-label="Run Manage">
      {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        const needsScope = href === RUN_MANAGE_SERIES_PATH || href === RUN_MANAGE_THIS_WEEK_PATH;
        return (
          <Link
            key={href}
            href={needsScope ? scopeHref(href) : href}
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

function RunManageShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scope = scopeFromSearchParams(searchParams);
  const scopeHref = (path: string) => appendScopeToPath(path, scope);
  const { user, signOutRunManage } = useRunManageAuth();
  const isAuthSurface =
    pathname === "/runmanage/signin" ||
    pathname === "/runmanage/no-access" ||
    pathname === "/welcome-runmanage";

  if (isAuthSurface) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  const scopeBar = showScopeBarForPath(pathname);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Link href={RUN_MANAGE_DASHBOARD_PATH} className="text-lg font-semibold text-sky-700">
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
          <NavLinks pathname={pathname} className="flex gap-2 overflow-x-auto" scopeHref={scopeHref} />
        </div>
      </header>

      {scopeBar ? <RunManageScopeBar /> : null}

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white p-3">
          <NavLinks pathname={pathname} className="flex flex-col gap-1" scopeHref={scopeHref} />
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function RunManageShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50">{children}</div>}>
      <RunManageShellInner>{children}</RunManageShellInner>
    </Suspense>
  );
}
